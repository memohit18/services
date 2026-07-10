import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FoodMaster } from '@prisma/client';
import type { MealDistribution } from '../../../ai/shared/diet-targets.types';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GenerateMealPlanDto } from '../dto/generate-meal-plan.dto';
import { buildDailyMealItems, type MacroTargets } from './meal-generator';

@Injectable()
export class MealGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, dto: GenerateMealPlanDto) {
    // Legacy rule-based path still requires dietPlanId
    if (!dto.dietPlanId) {
      throw new BadRequestException('dietPlanId is required for rule-based generation');
    }
    const planType = dto.planType ?? 'weekly';
    const dietPlan = await this.prisma.dietPlan.findFirst({
      where: { id: dto.dietPlanId, userId },
    });
    if (!dietPlan) {
      throw new NotFoundException('Diet plan not found');
    }
    if (
      dietPlan.caloriesTarget == null ||
      dietPlan.proteinTarget == null ||
      dietPlan.carbsTarget == null ||
      dietPlan.fatsTarget == null
    ) {
      throw new BadRequestException('Diet plan is missing macro targets');
    }

    const profile = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });

    const preferences = await this.prisma.userFoodPreference.findMany({
      where: { userId },
    });
    const excluded = new Set(
      preferences
        .filter((p) => p.preferenceType === 'allergy' || p.preferenceType === 'restricted')
        .map((p) => p.foodId),
    );
    const favorites = new Set(
      preferences.filter((p) => p.preferenceType === 'favorite').map((p) => p.foodId),
    );

    const foods = await this.prisma.foodMaster.findMany({
      where: {
        AND: [
          { OR: [{ isVerified: true }, { createdByUserId: userId }] },
          { id: { notIn: [...excluded] } },
          ...(profile?.dietType
            ? [{ OR: [{ dietType: profile.dietType }, { dietType: null }] }]
            : []),
        ],
      },
      orderBy: { name: 'asc' },
    });

    if (foods.length === 0) {
      throw new BadRequestException(
        'No eligible foods found for meal generation — add catalog items or food preferences',
      );
    }

    const dailyTargets: MacroTargets = {
      calories: dietPlan.caloriesTarget,
      protein: dietPlan.proteinTarget,
      carbs: dietPlan.carbsTarget,
      fats: dietPlan.fatsTarget,
    };
    const mealDistribution = dietPlan.mealDistribution as MealDistribution | null;

    const dayCount = dto.days ?? (planType === 'weekly' ? 7 : 30);
    const generateDays = Math.min(dayCount, 7);

    const latest = await this.prisma.mealPlan.findFirst({
      where: { userId, planType },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const allItems = this.buildWeekItems(
      foods,
      favorites,
      dailyTargets,
      generateDays,
      mealDistribution,
    );

    const mealPlan = await this.prisma.mealPlan.create({
      data: {
        userId,
        dietPlanId: dietPlan.id,
        version,
        planType,
        status: 'draft',
        items: {
          create: allItems,
        },
      },
      include: {
        items: { include: { food: true }, orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }] },
      },
    });

    return mealPlan;
  }

  private buildWeekItems(
    foods: FoodMaster[],
    favorites: Set<string>,
    dailyTargets: MacroTargets,
    days: number,
    mealDistribution?: MealDistribution | null,
  ) {
    const allItems = [];
    for (let day = 1; day <= days; day++) {
      const rotated = this.rotateFoods(foods, day);
      const dayItems = buildDailyMealItems(
        rotated,
        favorites,
        dailyTargets,
        day,
        mealDistribution,
      );
      allItems.push(...dayItems);
    }
    return allItems;
  }

  /** Slight variety across days without calling AI. */
  private rotateFoods(foods: FoodMaster[], day: number) {
    if (foods.length <= 1) {
      return foods;
    }
    const offset = (day - 1) % foods.length;
    return [...foods.slice(offset), ...foods.slice(0, offset)];
  }
}
