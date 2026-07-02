import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { calculateFitnessMetrics } from '../../shared/utils/fitness-calculator';
import { GeminiService } from '../gemini/gemini.service';
import {
  AiRemainingMacros,
  DIET_TARGETS_PROMPT_VERSION,
} from '../shared/diet-targets.types';
import { AiContextService } from '../shared/ai-context.service';
import { buildDietTargetsPrompt } from './diet-targets.prompt';

@Injectable()
export class AiDietTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly contextService: AiContextService,
  ) {}

  async generateAndSave(userId: string) {
    const ctx = await this.contextService.buildCoachContext(userId);
    if (!ctx.profile) {
      throw new NotFoundException('Fitness profile required before generating diet targets');
    }

    const profile = ctx.profile;
    const { dailyCalories, proteinTarget, transformationId } =
      await this.resolveEngineTargets(userId, profile);

    const prompt = buildDietTargetsPrompt({
      dailyCalories,
      proteinTarget,
      fitnessGoal: profile.fitnessGoal,
      dietType: profile.dietType,
      activityLevel: profile.activityLevel,
      budgetPreference: profile.budgetPreference,
      targetWeightKg: profile.targetWeightKg,
    });

    const targets = await this.gemini.generateJson<AiRemainingMacros>(prompt);

    const latest = await this.prisma.dietPlan.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.dietPlan.create({
      data: {
        userId,
        transformationId,
        version,
        status: 'draft',
        goal: profile.fitnessGoal,
        caloriesTarget: dailyCalories,
        proteinTarget,
        carbsTarget: targets.carbs,
        fatsTarget: targets.fats,
        mealDistribution: targets.mealDistribution as Prisma.InputJsonValue,
        generatedBy: 'ai',
        aiMetadata: this.gemini.buildMetadata(
          DIET_TARGETS_PROMPT_VERSION,
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveEngineTargets(
    userId: string,
    profile: NonNullable<
      Awaited<ReturnType<AiContextService['buildCoachContext']>>['profile']
    >,
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
