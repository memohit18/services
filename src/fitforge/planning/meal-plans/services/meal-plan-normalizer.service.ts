import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { FoodMaster } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AiDietResponse } from '../../diet/ai/diet-response.schema';
import { MealPlanRepository } from '../repositories/meal-plan.repository';

export type NormalizedMealItemInput = {
  dayNumber: number;
  mealType: string;
  foodId: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

/**
 * MealPlanNormalizer — parse AI diet JSON → meal_plans + meal_plan_items.
 * Never calls the LLM.
 */
@Injectable()
export class MealPlanNormalizer {
  private readonly logger = new Logger(MealPlanNormalizer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mealPlanRepository: MealPlanRepository,
  ) {}

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
    const items = await this.normalizeMeals(params.userId, response);
    const planType = params.planType ?? 'weekly';
    const latest = await this.mealPlanRepository.latestVersion(
      params.userId,
      planType,
    );
    const version = (latest?.version ?? 0) + 1;

    return this.mealPlanRepository.createActiveWithItems({
      userId: params.userId,
      dietPlanId: params.dietPlanId,
      version,
      planType,
      items,
    });
  }

  async normalizeMeals(
    userId: string,
    response: AiDietResponse,
  ): Promise<NormalizedMealItemInput[]> {
    if (!response?.meals?.length) {
      throw new BadRequestException('AI responseJson has no meals');
    }

    const foodByName = await this.loadFoodIndex(userId);
    const items: NormalizedMealItemInput[] = [];

    for (const meal of response.meals) {
      const food = this.resolveFood(foodByName, meal.foodName);
      if (!food) {
        // Food may have been deleted from catalog — skip and continue
        this.logger.warn(
          `Skipping unknown/removed food in AI meal plan: ${meal.foodName}`,
        );
        continue;
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

    if (items.length === 0) {
      throw new BadRequestException(
        'No meal items could be resolved from available foods',
      );
    }

    return items;
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

    const map = new Map<
      string,
      Pick<FoodMaster, 'id' | 'name' | 'calories' | 'protein' | 'carbs' | 'fats'>
    >();
    for (const food of foods) {
      map.set(food.name.trim().toLowerCase(), food);
    }
    return map;
  }

  private resolveFood(
    index: Map<
      string,
      Pick<FoodMaster, 'id' | 'name' | 'calories' | 'protein' | 'carbs' | 'fats'>
    >,
    foodName: string,
  ) {
    return index.get(foodName.trim().toLowerCase()) ?? null;
  }
}
