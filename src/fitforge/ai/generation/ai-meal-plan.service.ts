import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AiGenerationPipeline,
  buildMealPlanPrompt,
  normalizeMealPlanItems,
  validateMealPlanResponse,
  type NormalizedMealItem,
} from '../pipeline';
import { AiContextService } from '../shared/ai-context.service';

type MealPlanContext = {
  userId: string;
  dietPlanId: string;
  planType: string;
  days: number;
  dietPlan: {
    caloriesTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatsTarget: number;
    goal: string | null;
  };
  dietType: string;
  fitnessGoal: string;
  budget: string;
  favorites: string[];
  avoid: string[];
};

@Injectable()
export class AiMealPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: AiContextService,
    private readonly pipeline: AiGenerationPipeline,
  ) {}

  async generate(userId: string, dto: { dietPlanId: string; planType: string; days?: number }) {
    const { data } = await this.pipeline.runJson<
      MealPlanContext,
      ReturnType<typeof validateMealPlanResponse>,
      NormalizedMealItem[],
      Awaited<ReturnType<PrismaService['mealPlan']['create']>>
    >({
      collectContext: async () => {
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

        const ctx = await this.contextService.buildCoachContext(userId);
        const profile = ctx.profile;
        const days = dto.days ?? (dto.planType === 'weekly' ? 7 : 7);

        const favorites = await this.prisma.userFoodPreference.findMany({
          where: { userId, preferenceType: 'favorite' },
          include: { food: true },
        });
        const allergies = await this.prisma.userFoodPreference.findMany({
          where: { userId, preferenceType: { in: ['allergy', 'restricted'] } },
          include: { food: true },
        });

        return {
          userId,
          dietPlanId: dto.dietPlanId,
          planType: dto.planType,
          days,
          dietPlan: {
            caloriesTarget: dietPlan.caloriesTarget,
            proteinTarget: dietPlan.proteinTarget,
            carbsTarget: dietPlan.carbsTarget,
            fatsTarget: dietPlan.fatsTarget,
            goal: dietPlan.goal,
          },
          dietType: profile?.dietType ?? 'vegetarian',
          fitnessGoal: dietPlan.goal ?? profile?.fitnessGoal ?? 'maintenance',
          budget: profile?.budgetPreference ?? 'moderate',
          favorites: favorites.map((f) => f.food.name),
          avoid: allergies.map((a) => a.food.name),
        };
      },
      buildPrompt: (context) =>
        buildMealPlanPrompt({
          days: context.days,
          caloriesTarget: context.dietPlan.caloriesTarget,
          proteinTarget: context.dietPlan.proteinTarget,
          carbsTarget: context.dietPlan.carbsTarget,
          fatsTarget: context.dietPlan.fatsTarget,
          dietType: context.dietType,
          goal: context.fitnessGoal,
          budget: context.budget,
          favorites: context.favorites,
          avoid: context.avoid,
        }),
      validate: validateMealPlanResponse,
      normalize: (raw) => {
        const items = normalizeMealPlanItems(raw);
        if (items.length === 0) {
          throw new BadRequestException('AI returned no meal items');
        }
        return items;
      },
      save: async (items, context) => {
        const latest = await this.prisma.mealPlan.findFirst({
          where: { userId: context.userId, planType: context.planType },
          orderBy: { version: 'desc' },
        });
        const version = (latest?.version ?? 0) + 1;

        const createItems = [];
        for (const item of items) {
          const food = await this.resolveFood(
            context.userId,
            item.foodName,
            context.dietType,
          );
          const quantity = 1;
          createItems.push({
            dayNumber: item.dayNumber,
            mealType: item.mealType,
            foodId: food.id,
            quantity,
            calories: Math.round(food.calories * quantity),
            protein: Math.round(food.protein * quantity * 10) / 10,
            carbs: Math.round(food.carbs * quantity * 10) / 10,
            fats: Math.round(food.fats * quantity * 10) / 10,
          });
        }

        return this.prisma.mealPlan.create({
          data: {
            userId: context.userId,
            dietPlanId: context.dietPlanId,
            version,
            planType: context.planType,
            status: 'draft',
            items: { create: createItems },
          },
          include: {
            items: {
              include: { food: true },
              orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }],
            },
          },
        });
      },
    });

    return data;
  }

  private async resolveFood(
    userId: string,
    name: string,
    dietType?: string | null,
  ) {
    const food = await this.prisma.foodMaster.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        OR: [{ isVerified: true }, { createdByUserId: userId }],
      },
    });
    if (food) {
      return food;
    }

    const fuzzy = await this.prisma.foodMaster.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' },
        OR: [{ isVerified: true }, { createdByUserId: userId }],
      },
    });
    if (fuzzy) {
      return fuzzy;
    }

    return this.prisma.foodMaster.create({
      data: {
        name,
        dietType: dietType ?? undefined,
        servingSize: '1 serving',
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 8,
        createdByUserId: userId,
        isCustom: true,
        isVerified: false,
      },
    });
  }
}
