import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FoodMaster } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AiDietResponse } from '../ai/diet-response.schema';

/**
 * Converts audited AI diet JSON → relational meal_plans + meal_plan_items.
 * Never calls the LLM.
 */
@Injectable()
export class DietMealNormalizerService {
  constructor(private readonly prisma: PrismaService) {}

  async materializeFromDietPlan(params: {
    userId: string;
    dietPlanId: string;
    planType?: string;
  }) {
    const dietPlan = await this.prisma.dietPlan.findFirst({
      where: { id: params.dietPlanId, userId: params.userId },
    });
    if (!dietPlan) {
      throw new NotFoundException('Diet plan not found');
    }
    if (!dietPlan.responseJson) {
      throw new BadRequestException(
        'Diet plan has no AI responseJson to normalize',
      );
    }

    const response = dietPlan.responseJson as AiDietResponse;
    if (!response?.meals?.length) {
      throw new BadRequestException('AI responseJson has no meals');
    }

    const foodByName = await this.loadFoodIndex(params.userId);
    const items: Array<{
      dayNumber: number;
      mealType: string;
      foodId: string;
      quantity: number;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    }> = [];

    for (const meal of response.meals) {
      const food = this.resolveFood(foodByName, meal.foodName);
      if (!food) {
        throw new BadRequestException(
          `Cannot normalize unknown food: ${meal.foodName}`,
        );
      }
      const quantity = meal.quantity ?? 1;
      items.push({
        dayNumber: meal.dayNumber,
        mealType: meal.mealType,
        foodId: food.id,
        quantity,
        calories: Math.round(food.calories * quantity),
        protein: Math.round(food.protein * quantity * 10) / 10,
        carbs: Math.round(food.carbs * quantity * 10) / 10,
        fats: Math.round(food.fats * quantity * 10) / 10,
      });
    }

    const planType = params.planType ?? 'weekly';
    const latest = await this.prisma.mealPlan.findFirst({
      where: { userId: params.userId, planType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.updateMany({
        where: { userId: params.userId, status: 'active' },
        data: { status: 'archived', endDate: new Date() },
      });

      return tx.mealPlan.create({
        data: {
          userId: params.userId,
          dietPlanId: params.dietPlanId,
          version,
          planType,
          status: 'active',
          startDate: new Date(),
          items: { create: items },
        },
        include: {
          items: {
            include: { food: true },
            orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }],
          },
        },
      });
    });
  }

  private async loadFoodIndex(userId: string) {
    const foods = await this.prisma.foodMaster.findMany({
      where: {
        OR: [{ isVerified: true }, { isCustom: true, createdByUserId: userId }],
      },
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fats: true,
      },
    });

    const map = new Map<string, Pick<FoodMaster, 'id' | 'name' | 'calories' | 'protein' | 'carbs' | 'fats'>>();
    for (const food of foods) {
      map.set(food.name.trim().toLowerCase(), food);
    }
    return map;
  }

  private resolveFood(
    index: Map<string, Pick<FoodMaster, 'id' | 'name' | 'calories' | 'protein' | 'carbs' | 'fats'>>,
    foodName: string,
  ) {
    return index.get(foodName.trim().toLowerCase()) ?? null;
  }
}
