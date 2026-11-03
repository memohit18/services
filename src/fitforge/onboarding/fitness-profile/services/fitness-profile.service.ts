import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { UserFitnessProfile } from '@prisma/client';
import { Model } from 'mongoose';
import {
  USER_IMAGE_MODEL,
  type UserImageDocument,
} from '../../../../../db-schema/mongodb/schemas/user-image.schema';
import { ONBOARDING_STEPS } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { calculateFitnessMetrics } from '../../../shared/utils/fitness-calculator';
import {
  normalizeActivityLevel,
  normalizeDietType,
} from '../../../shared/utils/fitness-normalizers';
import { CreateFitnessProfileDto } from '../dto/create-fitness-profile.dto';
import { UpdateFitnessProfileDto } from '../dto/update-fitness-profile.dto';
import { UserOnboardingService } from '../../user-onboarding/services/user-onboarding.service';

@Injectable()
export class FitnessProfileService {
  private readonly logger = new Logger(FitnessProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly onboardingService: UserOnboardingService,
    @InjectModel(USER_IMAGE_MODEL)
    private readonly userImages: Model<UserImageDocument>,
  ) {}

  async create(userId: string, dto: CreateFitnessProfileDto) {
    const existing = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Fitness profile already exists');
    }

    await this.ensurePhysiqueGoal(dto.physiqueGoalId);
    this.validateTargetWeight(dto);

    const profile = await this.prisma.userFitnessProfile.create({
      data: this.toProfileData(userId, dto),
    });

    await this.onboardingService.advanceToStep(
      userId,
      ONBOARDING_STEPS.FOOD_PREFERENCES,
    );

    await this.redis.del(FitForgeCacheKeys.fitnessProfile(userId));
    return profile;
  }

  async getByUserId(userId: string) {
    const cacheKey = FitForgeCacheKeys.fitnessProfile(userId);
    const cached = await this.redis.get<UserFitnessProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Fitness profile not found');
    }

    await this.redis.set(cacheKey, profile, FitForgeCacheTTL.FITNESS_PROFILE);
    return profile;
  }

  async update(userId: string, dto: UpdateFitnessProfileDto) {
    const existing = await this.getByUserId(userId);
    if (dto.physiqueGoalId) {
      await this.ensurePhysiqueGoal(dto.physiqueGoalId);
    }
    this.validateTargetWeight({
      fitnessGoal: dto.fitnessGoal ?? existing.fitnessGoal,
      weightKg: dto.weightKg ?? existing.weightKg,
      targetWeightKg: dto.targetWeightKg ?? existing.targetWeightKg,
    });

    const profile = await this.prisma.userFitnessProfile.update({
      where: { userId },
      data: {
        ...dto,
        activityLevel: dto.activityLevel
          ? normalizeActivityLevel(dto.activityLevel)
          : undefined,
        dietType: dto.dietType ? normalizeDietType(dto.dietType) : undefined,
      },
    });

    await this.redis.del(FitForgeCacheKeys.fitnessProfile(userId));
    await this.redis.clearUserFitForgeCache(userId);
    return profile;
  }

  async deleteByUserId(userId: string) {
    const existing = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException('Fitness profile not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutLog.deleteMany({ where: { userId } });
      await tx.workoutSessionLog.deleteMany({ where: { userId } });
      await tx.dailyCheckin.deleteMany({ where: { userId } });
      await tx.mealLog.deleteMany({ where: { userId } });
      await tx.groceryList.deleteMany({ where: { userId } });
      await tx.mealPlan.deleteMany({ where: { userId } });
      await tx.dietPlan.deleteMany({ where: { userId } });
      await tx.workoutPlan.deleteMany({ where: { userId } });
      await tx.transformationTarget.deleteMany({ where: { userId } });
      await tx.hydrationLog.deleteMany({ where: { userId } });
      await tx.progressLog.deleteMany({ where: { userId } });
      await tx.progressPhoto.deleteMany({ where: { userId } });
      await tx.userFoodPreference.deleteMany({ where: { userId } });
      await tx.userNutritionPreference.deleteMany({ where: { userId } });
      await tx.aiChatSession.deleteMany({ where: { userId } });
      await tx.upload.deleteMany({ where: { userId } });
      await tx.foodMaster.deleteMany({
        where: {
          createdByUserId: userId,
          isCustom: true,
          foodPreferences: { none: {} },
          mealPlanItems: { none: {} },
          mealLogsAsOriginal: { none: {} },
          mealLogsAsReplacement: { none: {} },
        },
      });
      await tx.userOnboarding.updateMany({
        where: { userId },
        data: {
          currentStep: 1,
          isCompleted: false,
          completedAt: null,
        },
      });
      await tx.userFitnessProfile.delete({ where: { userId } });
    });

    try {
      await this.userImages.deleteMany({ userId }).exec();
    } catch (error) {
      this.logger.error(
        `Fitness profile deleted for ${userId}, but stored images could not be removed`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.redis.clearUserFitForgeCache(userId);
    return { deleted: true };
  }

  async getMetrics(userId: string) {
    const profile = await this.getByUserId(userId);
    return calculateFitnessMetrics({
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      fitnessGoal: profile.fitnessGoal,
    });
  }

  private toProfileData(userId: string, dto: CreateFitnessProfileDto) {
    return {
      userId,
      age: dto.age,
      gender: dto.gender,
      heightCm: dto.heightCm,
      weightKg: dto.weightKg,
      activityLevel: normalizeActivityLevel(dto.activityLevel),
      dietType: normalizeDietType(dto.dietType),
      fitnessGoal: dto.fitnessGoal,
      physiqueGoalId: dto.physiqueGoalId,
      targetWeightKg: dto.targetWeightKg,
      targetBodyFat: dto.targetBodyFat,
      workoutDaysPerWeek: dto.workoutDaysPerWeek,
      experienceLevel: dto.experienceLevel,
      allergies: dto.allergies,
      budgetPreference: dto.budgetPreference ?? 'moderate',
      workoutMode: dto.workoutMode,
      equipmentAvailable: dto.equipmentAvailable ?? undefined,
    };
  }

  private validateTargetWeight(input: {
    fitnessGoal: string;
    weightKg: number;
    targetWeightKg?: number | null;
  }) {
    if (
      input.fitnessGoal === 'fat_loss' &&
      input.targetWeightKg != null &&
      input.targetWeightKg >= input.weightKg
    ) {
      throw new BadRequestException(
        'Target weight must be lower than current weight for fat loss',
      );
    }
  }

  private async ensurePhysiqueGoal(id: string) {
    const goal = await this.prisma.physiqueGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException('Physique goal not found');
    }
  }
}
