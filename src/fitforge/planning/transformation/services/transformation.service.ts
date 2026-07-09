import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UserFitnessProfile } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import {
  calculateEstimatedWeeks,
  calculateFitnessMetrics,
} from '../../../shared/utils/fitness-calculator';
import { FitnessProfileService } from '../../../onboarding/fitness-profile/services/fitness-profile.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import {
  MILESTONE_WEEKS,
  TRANSFORMATION_STATUS,
} from '../constants/transformation.constants';
import { toTransformationApi } from '../mappers/transformation.mapper';
import { TransformationRepository } from '../repositories/transformation.repository';

const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 300;

@Injectable()
export class TransformationService {
  private readonly logger = new Logger(TransformationService.name);

  constructor(
    private readonly repository: TransformationRepository,
    private readonly fitnessProfileService: FitnessProfileService,
    private readonly redis: RedisService,
  ) {}

  async generate(userId: string) {
    const profile = await this.fitnessProfileService.getByUserId(userId);
    const physiqueGoal = await this.repository.findPhysiqueGoal(
      profile.physiqueGoalId,
    );

    const targetWeightKg = profile.targetWeightKg ?? profile.weightKg;
    this.validateTargetWeight(profile, targetWeightKg);

    const metrics = calculateFitnessMetrics({
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
      targetWeightKg,
    });

    const targetBodyFat =
      profile.targetBodyFat ?? physiqueGoal?.targetBodyFatMin ?? null;

    const estimatedWeeks = calculateEstimatedWeeks(
      profile.weightKg,
      targetWeightKg,
      profile.fitnessGoal,
    );

    await this.repository.archivePreviousActive(userId);

    const transformation = await this.repository.create({
      user: { connect: { id: userId } },
      currentWeightKg: profile.weightKg,
      targetWeightKg,
      currentBodyFat: null,
      targetBodyFat,
      estimatedWeeks,
      targetPhysique: physiqueGoal?.name ?? null,
      status: TRANSFORMATION_STATUS.ACTIVE,
      bmi: metrics.bmi,
      bmr: metrics.bmr,
      tdee: metrics.tdee,
      dailyCalorieTarget: metrics.dailyCalorieTarget,
      proteinTarget: metrics.proteinTarget,
      milestones: {
        create: this.buildMilestones(
          profile,
          targetWeightKg,
          targetBodyFat,
          estimatedWeeks,
        ),
      },
    });

    await this.redis.del(FitForgeCacheKeys.activeTransformation(userId));
    this.logger.log(`Transformation generated for user ${userId}`);

    return toTransformationApi(transformation, true);
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeTransformation(userId);
    const cached = await this.redis.get<
      ReturnType<typeof toTransformationApi>
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.repository.findActive(userId);
    if (!plan) {
      throw new NotFoundException('No active transformation plan');
    }

    const response = toTransformationApi(plan, true);
    await this.redis.set(cacheKey, response, FitForgeCacheTTL.ACTIVE_PLAN);
    return response;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repository.findHistory(
      userId,
      skip,
      limit,
    );
    return paginatedResponse(
      items.map((item) => toTransformationApi(item)),
      total,
      page,
      limit,
    );
  }

  async getMilestones(userId: string, id: string) {
    const plan = await this.repository.findMilestones(userId, id);
    if (!plan) {
      throw new NotFoundException('Transformation plan not found');
    }
    return plan.milestones;
  }

  private validateTargetWeight(
    profile: UserFitnessProfile,
    targetWeightKg: number,
  ) {
    if (targetWeightKg < MIN_WEIGHT_KG || targetWeightKg > MAX_WEIGHT_KG) {
      throw new BadRequestException(
        `Target weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg`,
      );
    }
    if (
      profile.fitnessGoal === 'fat_loss' &&
      targetWeightKg >= profile.weightKg
    ) {
      throw new BadRequestException(
        'Target weight must be lower than current weight for fat loss',
      );
    }
  }

  private buildMilestones(
    profile: UserFitnessProfile,
    targetWeightKg: number,
    targetBodyFat: number | null,
    estimatedWeeks: number,
  ) {
    return MILESTONE_WEEKS.map((weekNumber) => {
      const progress = weekNumber / (estimatedWeeks || weekNumber);
      const weightDelta = (profile.weightKg - targetWeightKg) * progress;
      return {
        weekNumber,
        targetWeightKg: round1(profile.weightKg - weightDelta),
        targetBodyFat,
        status: 'pending',
      };
    });
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
