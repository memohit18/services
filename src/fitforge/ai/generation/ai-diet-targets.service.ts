import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { calculateFitnessMetrics } from '../../shared/utils/fitness-calculator';
import { GeminiService } from '../gemini/gemini.service';
import {
  AiGenerationPipeline,
  normalizeDietTargets,
  validateDietTargetsResponse,
  type NormalizedDietTargets,
} from '../pipeline';
import {
  DIET_TARGETS_PROMPT_VERSION,
} from '../shared/diet-targets.types';
import { AiContextService } from '../shared/ai-context.service';
import { buildDietTargetsPrompt } from './diet-targets.prompt';

type DietTargetsContext = {
  userId: string;
  profile: NonNullable<
    Awaited<ReturnType<AiContextService['buildCoachContext']>>['profile']
  >;
  dailyCalories: number;
  proteinTarget: number;
  transformationId: string | null;
};

@Injectable()
export class AiDietTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly contextService: AiContextService,
    private readonly pipeline: AiGenerationPipeline,
  ) {}

  async generateAndSave(userId: string) {
    const { data } = await this.pipeline.runJson<
      DietTargetsContext,
      ReturnType<typeof validateDietTargetsResponse>,
      NormalizedDietTargets,
      Awaited<ReturnType<PrismaService['dietPlan']['create']>>
    >({
      promptVersion: DIET_TARGETS_PROMPT_VERSION,
      collectContext: async () => {
        const ctx = await this.contextService.buildCoachContext(userId);
        if (!ctx.profile) {
          throw new NotFoundException(
            'Fitness profile required before generating diet targets',
          );
        }
        const engine = await this.resolveEngineTargets(userId, ctx.profile);
        return {
          userId,
          profile: ctx.profile,
          ...engine,
        };
      },
      buildPrompt: (context) =>
        buildDietTargetsPrompt({
          dailyCalories: context.dailyCalories,
          proteinTarget: context.proteinTarget,
          fitnessGoal: context.profile.fitnessGoal,
          dietType: context.profile.dietType,
          activityLevel: context.profile.activityLevel,
          budgetPreference: context.profile.budgetPreference,
          targetWeightKg: context.profile.targetWeightKg,
        }),
      validate: validateDietTargetsResponse,
      normalize: (raw, context) =>
        normalizeDietTargets(raw, {
          dailyCalories: context.dailyCalories,
          proteinTarget: context.proteinTarget,
        }),
      save: async (normalized, context) => {
        const latest = await this.prisma.dietPlan.findFirst({
          where: { userId: context.userId },
          orderBy: { version: 'desc' },
        });
        const version = (latest?.version ?? 0) + 1;

        return this.prisma.dietPlan.create({
          data: {
            userId: context.userId,
            transformationId: context.transformationId,
            version,
            status: 'draft',
            goal: context.profile.fitnessGoal,
            caloriesTarget: context.dailyCalories,
            proteinTarget: context.proteinTarget,
            carbsTarget: normalized.carbs,
            fatsTarget: normalized.fats,
            mealDistribution:
              normalized.mealDistribution as Prisma.InputJsonValue,
            generatedBy: 'ai',
            aiMetadata: this.gemini.buildMetadata(
              DIET_TARGETS_PROMPT_VERSION,
            ) as Prisma.InputJsonValue,
          },
        });
      },
    });

    return data;
  }

  private async resolveEngineTargets(
    userId: string,
    profile: DietTargetsContext['profile'],
  ) {
    const activeTransformation = await this.prisma.transformationTarget.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dailyCalorieTarget: true,
        proteinTarget: true,
      },
    });

    if (
      activeTransformation?.dailyCalorieTarget != null &&
      activeTransformation?.proteinTarget != null
    ) {
      return {
        dailyCalories: activeTransformation.dailyCalorieTarget,
        proteinTarget: activeTransformation.proteinTarget,
        transformationId: activeTransformation.id,
      };
    }

    const metrics = calculateFitnessMetrics({
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
    });

    return {
      dailyCalories: metrics.dailyCalorieTarget,
      proteinTarget: metrics.proteinTarget,
      transformationId: null,
    };
  }
}
