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
import { UpdateMealPlanItemDto } from '../dto/update-meal-plan-item.dto';

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateMealPlanDto) {
    const dietPlan = await this.prisma.dietPlan.findFirst({
      where: { id: dto.dietPlanId, userId },
    });
    if (!dietPlan) {
      throw new NotFoundException('Diet plan not found');
    }

    const latest = await this.prisma.mealPlan.findFirst({
      where: { userId, planType: dto.planType },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.mealPlan.create({
      data: {
        userId,
        dietPlanId: dto.dietPlanId,
        version,
        planType: dto.planType,
        status: 'draft',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
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

    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: { items: { include: { food: true }, orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }] } },
    });
    if (!plan) {
      throw new NotFoundException('No active meal plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.mealPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mealPlan.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getSchedule(userId: string, id: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { food: true },
          orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }],
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    const schedule = plan.items.reduce<Record<number, typeof plan.items>>((acc, item) => {
      if (!acc[item.dayNumber]) {
        acc[item.dayNumber] = [];
      }
      acc[item.dayNumber].push(item);
      return acc;
    }, {});

    return successResponse({ planId: plan.id, schedule }).data;
  }

  async addItem(userId: string, mealPlanId: string, dto: CreateMealPlanItemDto) {
    await this.ensureMealPlan(userId, mealPlanId);
    await this.ensureFood(dto.foodId);

    const item = await this.prisma.mealPlanItem.create({
      data: { mealPlanId, ...dto },
      include: { food: true },
    });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return item;
  }

  async updateItem(userId: string, itemId: string, dto: UpdateMealPlanItemDto) {
    const item = await this.prisma.mealPlanItem.findFirst({
      where: { id: itemId, mealPlan: { userId } },
    });
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    if (dto.foodId) {
      await this.ensureFood(dto.foodId);
    }

    const updated = await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data: dto,
      include: { food: true },
    });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return updated;
  }

  async deleteItem(userId: string, itemId: string) {
    const item = await this.prisma.mealPlanItem.findFirst({
      where: { id: itemId, mealPlan: { userId } },
    });
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }
    await this.prisma.mealPlanItem.delete({ where: { id: itemId } });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return { id: itemId };
  }

  async activate(userId: string, id: string) {
    const plan = await this.prisma.mealPlan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    await this.prisma.$transaction([
      this.prisma.mealPlan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      }),
      this.prisma.mealPlan.update({
        where: { id },
        data: { status: 'active', startDate: new Date() },
      }),
    ]);

    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return this.prisma.mealPlan.findUnique({
      where: { id },
      include: { items: { include: { food: true } } },
    });
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
