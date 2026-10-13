import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { LlmService } from '../../../../common/ai/llm.service';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { MealPlansService } from '../../../planning/meal-plans/services/meal-plans.service';
import { normalizeDietType } from '../../../shared/utils/fitness-normalizers';
import {
  FOOD_CATEGORY_LABELS,
  transformFoodCategoryInput,
  transformFoodCategoryUpdate,
} from '../constants/food-category.normalizer';
import { CreateCustomFoodDto } from '../dto/create-custom-food.dto';
import { CreateFoodDto } from '../dto/create-food.dto';
import type { EstimateFoodNutritionDto } from '../dto/estimate-food-nutrition.dto';
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { FoodsRepository } from '../repositories/foods.repository';

type NutritionEstimate = {
  name: string;
  servingSize: string;
  servingAmount: number | null;
  servingUnit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  note: string | null;
};

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    private readonly foodsRepository: FoodsRepository,
    private readonly mealPlansService: MealPlansService,
    private readonly llm: LlmService,
  ) {}

  async findAll(userId: string, query: ListFoodsQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.foodsRepository.findAll({
      userId,
      skip,
      take: limit,
      category: query.category,
      dietType: query.dietType ? normalizeDietType(query.dietType) : undefined,
      search: query.search,
    });
    return paginatedResponse(items, total, page, limit);
  }

  async findById(id: string, userId: string) {
    const food = await this.foodsRepository.findAccessibleById(id, userId);
    if (!food) {
      throw new NotFoundException('Food not found');
    }
    return food;
  }

  async createCustom(userId: string, dto: CreateCustomFoodDto) {
    return this.foodsRepository.create(this.toCreateInput(dto, userId, true));
  }

  /**
   * Estimate macros for a free-text meal description so users can confirm
   * before saving a custom food. Uses the shared FitForge LLM (Gemini/Grok).
   */
  async estimateNutrition(
    _userId: string,
    dto: EstimateFoodNutritionDto,
  ): Promise<NutritionEstimate> {
    if (!this.llm.isConfigured()) {
      throw new ServiceUnavailableException(
        'Nutrition estimate is unavailable (AI not configured)',
      );
    }

    const name = dto.name.trim();
    const servingHint = dto.servingSize?.trim() || '1 serving';
    const prompt = `Estimate nutrition for ONE serving of this home-cooked / restaurant food.
Return JSON only (no markdown):
{
  "name": "cleaned food name",
  "servingSize": "human label e.g. 1 bowl or 250 ml",
  "servingAmount": number or null,
  "servingUnit": "g" | "ml" | "piece" | "tbsp" | "serving" | null,
  "calories": integer kcal,
  "protein": number grams,
  "carbs": number grams,
  "fats": number grams,
  "note": "one short caveat or null"
}

Food: ${name}
Serving hint: ${servingHint}
Use typical Indian household portions when relevant. Be realistic; do not invent extreme values.`;

    const raw = await this.llm.generateJson<Record<string, unknown>>(prompt);
    const estimate = this.normalizeEstimate(raw, name, servingHint);
    if (estimate.calories < 0 || estimate.calories > 5000) {
      throw new BadRequestException('Could not estimate nutrition for that food');
    }
    return estimate;
  }

  private normalizeEstimate(
    raw: Record<string, unknown>,
    fallbackName: string,
    fallbackServing: string,
  ): NutritionEstimate {
    const num = (value: unknown, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const str = (value: unknown, fallback: string) =>
      typeof value === 'string' && value.trim() ? value.trim() : fallback;

    const servingAmountRaw = raw.servingAmount ?? raw.serving_amount;
    const servingAmount =
      servingAmountRaw == null || servingAmountRaw === ''
        ? null
        : num(servingAmountRaw, NaN);
    const servingUnitRaw = str(
      raw.servingUnit ?? raw.serving_unit ?? '',
      '',
    ).toLowerCase();
    const servingUnit = ['g', 'ml', 'piece', 'tbsp', 'serving'].includes(
      servingUnitRaw,
    )
      ? servingUnitRaw
      : null;

    return {
      name: str(raw.name, fallbackName),
      servingSize: str(raw.servingSize ?? raw.serving_size, fallbackServing),
      servingAmount: Number.isFinite(servingAmount) ? servingAmount : null,
      servingUnit,
      calories: Math.round(num(raw.calories)),
      protein: Math.round(num(raw.protein) * 10) / 10,
      carbs: Math.round(num(raw.carbs) * 10) / 10,
      fats: Math.round(num(raw.fats) * 10) / 10,
      note:
        typeof raw.note === 'string' && raw.note.trim()
          ? raw.note.trim()
          : null,
    };
  }

  async createVerified(dto: CreateFoodDto) {
    return this.foodsRepository.create(this.toCreateInput(dto, null, false));
  }

  async update(userId: string, role: string, id: string, dto: UpdateFoodDto) {
    const food = await this.foodsRepository.findById(id);
    if (!food) {
      throw new NotFoundException('Food not found');
    }

    this.assertCanModify(food, userId, role, 'update');

    return this.foodsRepository.update(id, this.toUpdateInput(dto));
  }

  async remove(userId: string, role: string, id: string) {
    const food = await this.foodsRepository.findById(id);
    if (!food) {
      throw new NotFoundException('Food not found');
    }

    this.assertCanModify(food, userId, role, 'delete');

    const { food: deleted, removedMealPlanItems, affectedActiveUserIds } =
      await this.foodsRepository.delete(id);

    for (const affectedUserId of affectedActiveUserIds) {
      void this.mealPlansService
        .rebuildActiveFromAvailableFoods(affectedUserId)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Meal plan rebuild after food delete failed for user ${affectedUserId}: ${message}`,
          );
        });
    }

    return {
      id: deleted.id,
      name: deleted.name,
      deleted: true,
      removedMealPlanItems,
      mealPlansQueuedForRebuild: affectedActiveUserIds.length,
    };
  }

  async getCategories() {
    const categories = await this.foodsRepository.categories();
    return {
      allowedCategories: FOOD_CATEGORIES.map((catId) => ({
        id: catId,
        label: FOOD_CATEGORY_LABELS[catId],
      })),
      categories: categories.map((category) => ({
        ...category,
        label:
          FOOD_CATEGORY_LABELS[
            category.id as keyof typeof FOOD_CATEGORY_LABELS
          ] ?? category.id,
      })),
    };
  }

  private assertCanModify(
    food: { isCustom: boolean; createdByUserId: string | null },
    userId: string,
    role: string,
    action: 'update' | 'delete',
  ) {
    if (food.isCustom) {
      if (food.createdByUserId !== userId) {
        throw new ForbiddenException(
          `You can only ${action} your own custom foods`,
        );
      }
      return;
    }

    if (role !== 'admin') {
      throw new ForbiddenException(`Only admins can ${action} catalog foods`);
    }
  }

  private toCreateInput(
    dto: CreateFoodDto,
    userId: string | null,
    isCustom: boolean,
  ): Prisma.FoodMasterCreateInput {
    return {
      name: dto.name,
      category: transformFoodCategoryInput(dto.category),
      dietType: dto.dietType ? normalizeDietType(dto.dietType) : undefined,
      servingSize: dto.servingSize,
      servingAmount: dto.servingAmount,
      servingUnit: dto.servingUnit,
      calories: dto.calories,
      protein: dto.protein,
      carbs: dto.carbs,
      fats: dto.fats,
      averageCost: dto.averageCost,
      imageUrl: dto.imageUrl,
      ...(userId ? { createdBy: { connect: { id: userId } } } : {}),
      isCustom,
      isVerified: !isCustom,
    };
  }

  private toUpdateInput(dto: UpdateFoodDto): Prisma.FoodMasterUpdateInput {
    const data: Prisma.FoodMasterUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.category !== undefined) {
      data.category =
        dto.category === null
          ? null
          : transformFoodCategoryUpdate(dto.category) ?? dto.category;
    }
    if (dto.dietType !== undefined) {
      data.dietType = dto.dietType ? normalizeDietType(dto.dietType) : null;
    }
    if (dto.servingSize !== undefined) {
      data.servingSize = dto.servingSize;
    }
    if (dto.servingAmount !== undefined) {
      data.servingAmount = dto.servingAmount;
    }
    if (dto.servingUnit !== undefined) {
      data.servingUnit = dto.servingUnit;
    }
    if (dto.calories !== undefined) {
      data.calories = dto.calories;
    }
    if (dto.protein !== undefined) {
      data.protein = dto.protein;
    }
    if (dto.carbs !== undefined) {
      data.carbs = dto.carbs;
    }
    if (dto.fats !== undefined) {
      data.fats = dto.fats;
    }
    if (dto.averageCost !== undefined) {
      data.averageCost = dto.averageCost;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl =
        dto.imageUrl === null || dto.imageUrl === ''
          ? null
          : dto.imageUrl.trim();
    }

    return data;
  }
}
