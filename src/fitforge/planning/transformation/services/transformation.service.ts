import { Injectable, NotFoundException } from '@nestjs/common';
import type { TransformationTarget, TransformationMilestone } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import {
  calculateEstimatedWeeks,
  calculateFitnessMetrics,
} from '../../../shared/utils/fitness-calculator';
import { FitnessProfileService } from '../../../onboarding/fitness-profile/services/fitness-profile.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';

const MILESTONE_WEEKS = [4, 8, 12, 16];

@Injectable()
export class TransformationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fitnessProfileService: FitnessProfileService,
    private readonly redis: RedisService,
  ) {}

  async generate(userId: string) {
    const profile = await this.fitnessProfileService.getByUserId(userId);
    const physiqueGoal = await this.prisma.physiqueGoal.findUnique({
      where: { id: profile.physiqueGoalId },
    });

    const metrics = calculateFitnessMetrics({
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
    });

    const targetWeightKg = profile.targetWeightKg ?? profile.weightKg;
    const targetBodyFat = profile.targetBodyFat ?? physiqueGoal?.targetBodyFatMin ?? null;
    const estimatedWeeks = calculateEstimatedWeeks(
      profile.weightKg,
      targetWeightKg,
      profile.fitnessGoal,
    );

    await this.prisma.transformationTarget.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'completed' },
    });

    const transformation = await this.prisma.transformationTarget.create({
      data: {
        userId,
        currentWeightKg: profile.weightKg,
        targetWeightKg,
        currentBodyFat: profile.targetBodyFat,
        targetBodyFat,
        estimatedWeeks,
        targetPhysique: physiqueGoal?.name,
        status: 'active',
        bmi: metrics.bmi,
        bmr: metrics.bmr,
        tdee: metrics.tdee,
        dailyCalorieTarget: metrics.dailyCalorieTarget,
        proteinTarget: metrics.proteinTarget,
        milestones: {
          create: MILESTONE_WEEKS.map((weekNumber) => {
            const progress = weekNumber / (estimatedWeeks || weekNumber);
            const weightDelta = (profile.weightKg - targetWeightKg) * progress;
            const bodyFatDelta =
              profile.targetBodyFat != null && profile.targetBodyFat != null
                ? (profile.targetBodyFat - (targetBodyFat ?? profile.targetBodyFat)) * progress
                : null;
            return {
              weekNumber,
              targetWeightKg: round1(profile.weightKg - weightDelta),
              targetBodyFat:
                bodyFatDelta != null && profile.targetBodyFat != null
                  ? round1(profile.targetBodyFat - bodyFatDelta)
                  : targetBodyFat,
              status: 'pending',
            };
          }),
        },
      },
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
    });

    await this.redis.del(FitForgeCacheKeys.activeTransformation(userId));
    return transformation;
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeTransformation(userId);
    const cached = await this.redis.get<
      TransformationTarget & { milestones: TransformationMilestone[] }
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.prisma.transformationTarget.findFirst({
      where: { userId, status: 'active' },
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) {
      throw new NotFoundException('No active transformation plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.transformationTarget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transformationTarget.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getMilestones(userId: string, id: string) {
    const plan = await this.prisma.transformationTarget.findFirst({
      where: { id, userId },
      include: { milestones: { orderBy: { weekNumber: 'asc' } } },
    });
    if (!plan) {
      throw new NotFoundException('Transformation plan not found');
    }
    return plan.milestones;
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
