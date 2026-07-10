import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MealPlan, MealPlanItem, FoodMaster } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse, successResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { CreateMealPlanItemDto } from '../dto/create-meal-plan-item.dto';
import { CreateMealPlanDto } from '../dto/create-meal-plan.dto';
import { GenerateMealPlanDto } from '../dto/generate-meal-plan.dto';
import { UpdateMealPlanItemDto } from '../dto/update-meal-plan-item.dto';
import { MealItemRepository } from '../repositories/meal-item.repository';
import { MealPlanRepository } from '../repositories/meal-plan.repository';
import { MealGeneratorService } from './meal-generator.service';
import { MealPlanNormalizer } from './meal-plan-normalizer.service';

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mealPlanRepository: MealPlanRepository,
    private readonly mealItemRepository: MealItemRepository,
    private readonly mealPlanNormalizer: MealPlanNormalizer,
    private readonly mealGeneratorService: MealGeneratorService,
  ) {}

  /**
   * Phase 5: generate from active (or specified) diet.
   * Prefers AI responseJson normalizer; falls back to rule-based FoodMaster picker.
   */
  async generateFromDiet(userId: string, dto: GenerateMealPlanDto) {
    const planType = dto.planType ?? 'weekly';
    const dietPlan = dto.dietPlanId
      ? await this.prisma.dietPlan.findFirst({
          where: { id: dto.dietPlanId, userId },
        })
      : await this.prisma.dietPlan.findFirst({
          where: { userId, status: 'active' },
          orderBy: { version: 'desc' },
        });

    if (!dietPlan) {
      throw new NotFoundException(
        dto.dietPlanId
          ? 'Diet plan not found'
          : 'No active diet plan. Generate a diet first.',
      );
    }

    let plan;
    if (dietPlan.responseJson) {
      plan = await this.mealPlanNormalizer.materializeFromDietPlan({
        userId,
        dietPlanId: dietPlan.id,
        planType,
      });
    } else {
      // Legacy diets without AI JSON — rule-based generation (draft then activate)
      const draft = await this.mealGeneratorService.generate(userId, {
        dietPlanId: dietPlan.id,
        planType,
        days: dto.days,
      });
      plan = await this.activate(userId, draft.id);
    }

    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return plan;
  }

  async create(userId: string, dto: CreateMealPlanDto) {
    const dietPlan = await this.prisma.dietPlan.findFirst({
      where: { id: dto.dietPlanId, userId },
    });
    if (!dietPlan) {
      throw new NotFoundException('Diet plan not found');
    }

    const latest = await this.mealPlanRepository.latestVersion(
      userId,
      dto.planType,
    );
    const version = (latest?.version ?? 0) + 1;

    return this.mealPlanRepository.createDraft({
      user: { connect: { id: userId } },
      dietPlan: { connect: { id: dto.dietPlanId } },
      version,
      planType: dto.planType,
      status: 'draft',
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeMealPlan(userId);
    const cached = await this.redis.get<
      MealPlan & { items: (MealPlanItem & { food: FoodMaster })[] }
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.mealPlanRepository.findActive(userId);
    if (!plan) {
      throw new NotFoundException('No active meal plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getById(userId: string, id: string) {
    const plan = await this.mealPlanRepository.findById(id, userId);
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await this.mealPlanRepository.findHistory(
      userId,
      skip,
      limit,
    );
    return paginatedResponse(items, total, page, limit);
  }

  async getSchedule(userId: string, id: string) {
    const plan = await this.mealPlanRepository.findById(id, userId);
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    const schedule = plan.items.reduce<Record<number, typeof plan.items>>(
      (acc, item) => {
        if (!acc[item.dayNumber]) {
          acc[item.dayNumber] = [];
        }
        acc[item.dayNumber].push(item);
        return acc;
      },
      {},
    );

    return successResponse({ planId: plan.id, schedule }).data;
  }

  async addItem(userId: string, mealPlanId: string, dto: CreateMealPlanItemDto) {
    await this.ensureMealPlan(userId, mealPlanId);
    await this.ensureFood(dto.foodId);

    const item = await this.mealItemRepository.create({
      mealPlan: { connect: { id: mealPlanId } },
      food: { connect: { id: dto.foodId } },
      dayNumber: dto.dayNumber,
      mealType: dto.mealType,
      quantity: dto.quantity,
      calories: dto.calories,
      protein: dto.protein,
      carbs: dto.carbs,
      fats: dto.fats,
    });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return item;
  }

  async updateItem(userId: string, itemId: string, dto: UpdateMealPlanItemDto) {
    const item = await this.mealItemRepository.findByIdForUser(itemId, userId);
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    if (dto.foodId) {
      await this.ensureFood(dto.foodId);
    }

    const updated = await this.mealItemRepository.update(itemId, {
      ...(dto.foodId ? { food: { connect: { id: dto.foodId } } } : {}),
      ...(dto.dayNumber !== undefined ? { dayNumber: dto.dayNumber } : {}),
      ...(dto.mealType !== undefined ? { mealType: dto.mealType } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.calories !== undefined ? { calories: dto.calories } : {}),
      ...(dto.protein !== undefined ? { protein: dto.protein } : {}),
      ...(dto.carbs !== undefined ? { carbs: dto.carbs } : {}),
      ...(dto.fats !== undefined ? { fats: dto.fats } : {}),
    });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return updated;
  }

  async deleteItem(userId: string, itemId: string) {
    const item = await this.mealItemRepository.findByIdForUser(itemId, userId);
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    await this.mealItemRepository.delete(itemId);
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return { id: itemId };
  }

  async activate(userId: string, id: string) {
    const plan = await this.prisma.mealPlan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    const activated = await this.mealPlanRepository.activate(userId, id);
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return activated;
  }

  private async ensureMealPlan(userId: string, mealPlanId: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, userId },
    });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }
    return plan;
  }

  private async ensureFood(foodId: string) {
    const food = await this.prisma.foodMaster.findUnique({ where: { id: foodId } });
    if (!food) {
      throw new BadRequestException('Food not found');
    }
  }
}
