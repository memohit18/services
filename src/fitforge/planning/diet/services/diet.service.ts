import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DietPlan } from '@prisma/client';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { calculateFitnessMetrics } from '../../../shared/utils/fitness-calculator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { DietAiGateway } from '../ai/diet-ai.gateway';
import { mapAiDietToDietPlan } from '../ai/diet-mapper';
import {
  buildDietPrompt,
  type DietPromptContext,
} from '../ai/diet-prompt.builder';
import { CreateDietDto } from '../dto/create-diet.dto';
import { CreateDietFromAiTargetsDto } from '../dto/create-diet-from-ai-targets.dto';
import { DietRepository } from '../repositories/diet.repository';
import { DietMealNormalizerService } from './diet-meal-normalizer.service';

@Injectable()
export class DietService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dietRepository: DietRepository,
    private readonly dietAiGateway: DietAiGateway,
    private readonly mealNormalizer: DietMealNormalizerService,
  ) {}

  /** Legacy: manual diet plan create (draft). */
  async create(userId: string, dto: CreateDietDto) {
    const latest = await this.dietRepository.latestVersion(userId);
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.dietPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: dto.goal,
        caloriesTarget: dto.caloriesTarget,
        proteinTarget: dto.proteinTarget,
        carbsTarget: dto.carbsTarget,
        fatsTarget: dto.fatsTarget,
        generatedBy: 'manual',
      },
    });
  }

  /** Legacy: persist AI macro targets only — meals built separately. */
  async createFromAiTargets(userId: string, dto: CreateDietFromAiTargetsDto) {
    const latest = await this.dietRepository.latestVersion(userId);
    const version = (latest?.version ?? 0) + 1;

    const profile = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });

    return this.prisma.dietPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: dto.goal ?? profile?.fitnessGoal,
        caloriesTarget: dto.dailyCalories,
        proteinTarget: dto.protein,
        carbsTarget: dto.carbs,
        fatsTarget: dto.fats,
        generatedBy: 'ai',
      },
    });
  }

  /** Legacy: activate a diet plan version (archives previous active). */
  async activate(userId: string, id: string) {
    const plan = await this.dietRepository.findById(id, userId);
    if (!plan) {
      throw new NotFoundException('Diet plan not found');
    }

    await this.prisma.$transaction([
      this.prisma.dietPlan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      }),
      this.prisma.dietPlan.update({
        where: { id },
        data: { status: 'active', startDate: new Date() },
      }),
    ]);

    await this.redis.del(FitForgeCacheKeys.activeDiet(userId));
    return this.prisma.dietPlan.findUnique({ where: { id } });
  }

  async generate(userId: string) {
    const context = await this.buildGenerationContext(userId);
    const prompt = buildDietPrompt(context.promptContext);

    const { response, metadata } = await this.dietAiGateway.generateDiet(
      prompt,
      {
        engineCalories: context.engineCalories,
        engineProtein: context.engineProtein,
        restrictedFoods: context.promptContext.restrictedFoods,
        allowedFoodNames: context.promptContext.catalogFoods.map((f) => f.name),
      },
    );

    const mapped = mapAiDietToDietPlan({
      response,
      prompt,
      metadata,
    });

    const latest = await this.dietRepository.latestVersion(userId);
    const version = (latest?.version ?? 0) + 1;

    const dietPlan = await this.dietRepository.createActiveVersion({
      userId,
      transformationId: context.transformationId,
      version,
      data: mapped,
    });

    const mealPlan = await this.mealNormalizer.materializeFromDietPlan({
      userId,
      dietPlanId: dietPlan.id,
      planType: 'weekly',
    });

    await this.redis.del(FitForgeCacheKeys.activeDiet(userId));
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));

    return { dietPlan, mealPlan };
  }

  async regenerate(userId: string) {
    return this.generate(userId);
  }

  async getActive(userId: string): Promise<DietPlan> {
    const cacheKey = FitForgeCacheKeys.activeDiet(userId);
    const cached = await this.redis.get<DietPlan>(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (!plan) {
      throw new NotFoundException('No active diet plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.dietPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { version: 'desc' },
      }),
      this.prisma.dietPlan.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async delete(userId: string, id: string) {
    const deleted = await this.dietRepository.deleteById(id, userId);
    if (!deleted) {
      throw new NotFoundException('Diet plan not found');
    }
    await this.redis.del(FitForgeCacheKeys.activeDiet(userId));
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    return { id };
  }

  private async buildGenerationContext(userId: string) {
    const [profile, nutrition, transformation, foodPrefs, catalogFoods] =
      await Promise.all([
        this.prisma.userFitnessProfile.findUnique({ where: { userId } }),
        this.prisma.userNutritionPreference.findUnique({ where: { userId } }),
        this.prisma.transformationTarget.findFirst({
          where: { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userFoodPreference.findMany({
          where: { userId },
          include: { food: true },
        }),
        this.prisma.foodMaster.findMany({
          where: { isVerified: true },
          take: 150,
          orderBy: { name: 'asc' },
          select: {
            name: true,
            calories: true,
            protein: true,
            carbs: true,
            fats: true,
            dietType: true,
          },
        }),
      ]);

    if (!profile) {
      throw new NotFoundException(
        'Fitness profile required before generating a diet plan',
      );
    }

    let engineCalories = transformation?.dailyCalorieTarget ?? null;
    let engineProtein = transformation?.proteinTarget ?? null;

    if (engineCalories == null || engineProtein == null) {
      const metrics = calculateFitnessMetrics({
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        fitnessGoal: profile.fitnessGoal,
      });
      engineCalories = metrics.dailyCalorieTarget;
      engineProtein = metrics.proteinTarget;
    }

    if (!engineCalories || !engineProtein) {
      throw new BadRequestException(
        'Unable to resolve calorie/protein targets for diet generation',
      );
    }

    const favorites = foodPrefs
      .filter((p) => p.preferenceType === 'favorite')
      .map((p) => p.food.name);
    const restricted = foodPrefs
      .filter((p) => p.preferenceType === 'restricted')
      .map((p) => p.food.name);
    const available = foodPrefs
      .filter((p) => p.preferenceType === 'available')
      .map((p) => p.food.name);

    const dietType = profile.dietType;
    const filteredCatalog = catalogFoods
      .filter((f) => {
        if (!f.dietType) return true;
        if (dietType === 'non_vegetarian') return true;
        if (dietType === 'eggetarian') {
          return f.dietType !== 'non_vegetarian';
        }
        if (dietType === 'vegetarian' || dietType === 'vegan') {
          return f.dietType === 'vegetarian' || f.dietType === 'vegan';
        }
        return true;
      })
      .map(({ name, calories, protein, carbs, fats }) => ({
        name,
        calories,
        protein,
        carbs,
        fats,
      }));

    if (filteredCatalog.length === 0) {
      throw new BadRequestException(
        'No verified foods available to build a diet plan. Seed the food catalog first.',
      );
    }

    const mealsPerDay = nutrition?.mealsPerDay ?? 4;
    const promptContext: DietPromptContext = {
      fitnessGoal: profile.fitnessGoal,
      dailyCalories: engineCalories,
      dailyProtein: engineProtein,
      dietType: profile.dietType,
      activityLevel: profile.activityLevel,
      workoutDaysPerWeek: profile.workoutDaysPerWeek,
      estimatedWeeks: transformation?.estimatedWeeks ?? null,
      favoriteFoods: favorites,
      restrictedFoods: restricted,
      availableFoods: available,
      budget: nutrition?.budgetCategory ?? profile.budgetPreference ?? 'moderate',
      cuisine: nutrition?.preferredCuisine ?? 'indian',
      mealsPerDay,
      cookingTimeMinutes: nutrition?.cookingTimeMinutes ?? null,
      mealTiming: nutrition?.preferredMealTiming ?? null,
      catalogFoods: filteredCatalog,
      days: 7,
    };

    return {
      promptContext,
      engineCalories,
      engineProtein,
      transformationId: transformation?.id ?? null,
    };
  }
}
