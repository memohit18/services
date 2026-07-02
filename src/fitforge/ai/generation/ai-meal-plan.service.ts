import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MEAL_TYPES } from '../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateMealPlanDto } from '../../planning/meal-plans/dto/generate-meal-plan.dto';
import { GeminiService } from '../gemini/gemini.service';
import { AiContextService } from '../shared/ai-context.service';

type AiMealDay = {
  day: number;
  breakfast?: string;
  lunch?: string;
  snack?: string;
  dinner?: string;
};

type AiMealPlanResponse = {
  days: AiMealDay[];
};

@Injectable()
export class AiMealPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly contextService: AiContextService,
  ) {}

  async generate(userId: string, dto: GenerateMealPlanDto) {
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

    const prompt = `Generate a ${days}-day Indian meal plan. Return JSON only.

Rules:
- Calories: ${dietPlan.caloriesTarget}
- Protein: ${dietPlan.proteinTarget}g
- Carbs: ${dietPlan.carbsTarget}g
- Fats: ${dietPlan.fatsTarget}g
- Diet type: ${profile?.dietType ?? 'vegetarian'}
- Goal: ${dietPlan.goal ?? profile?.fitnessGoal ?? 'maintenance'}
- Budget: ${profile?.budgetPreference ?? 'moderate'}
- Favorites: ${favorites.map((f) => f.food.name).join(', ') || 'none'}
- Avoid: ${allergies.map((a) => a.food.name).join(', ') || 'none'}

Return format:
{
  "days": [
    {
      "day": 1,
      "breakfast": "Poha",
      "lunch": "Dal Rice",
      "snack": "Fruit",
      "dinner": "Paneer Bhurji"
    }
  ]
}

Use common Indian food names. Include breakfast, lunch, snack, dinner for each day.`;

    const aiPlan = await this.gemini.generateJson<AiMealPlanResponse>(prompt);

    const latest = await this.prisma.mealPlan.findFirst({
      where: { userId, planType: dto.planType },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const items = [];
    for (const day of aiPlan.days ?? []) {
      for (const mealType of MEAL_TYPES) {
        const foodName = day[mealType as keyof AiMealDay];
        if (!foodName || typeof foodName !== 'string') {
          continue;
        }
        const food = await this.resolveFood(userId, foodName, profile?.dietType);
        const quantity = 1;
        items.push({
          dayNumber: day.day,
          mealType,
          foodId: food.id,
          quantity,
          calories: Math.round(food.calories * quantity),
          protein: Math.round(food.protein * quantity * 10) / 10,
          carbs: Math.round(food.carbs * quantity * 10) / 10,
          fats: Math.round(food.fats * quantity * 10) / 10,
        });
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('AI returned no meal items');
    }

    return this.prisma.mealPlan.create({
      data: {
        userId,
        dietPlanId: dto.dietPlanId,
        version,
        planType: dto.planType,
        status: 'draft',
        items: { create: items },
      },
      include: {
        items: { include: { food: true }, orderBy: [{ dayNumber: 'asc' }, { mealType: 'asc' }] },
      },
    });
  }

  private async resolveFood(userId: string, name: string, dietType?: string | null) {
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
