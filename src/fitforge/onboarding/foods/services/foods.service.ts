import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FOOD_CATEGORIES } from '../../../../../db-schema/postgres/constants/fitforge-values';
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
import { ListFoodsQueryDto } from '../dto/list-foods-query.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { FoodsRepository } from '../repositories/foods.repository';

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    private readonly foodsRepository: FoodsRepository,
    private readonly mealPlansService: MealPlansService,
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
