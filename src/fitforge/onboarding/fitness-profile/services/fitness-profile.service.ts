import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserFitnessProfile } from '@prisma/client';
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

@Injectable()
export class FitnessProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateFitnessProfileDto) {
    const existing = await this.prisma.userFitnessProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Fitness profile already exists');
    }

    await this.ensurePhysiqueGoal(dto.physiqueGoalId);

    const profile = await this.prisma.userFitnessProfile.create({
      data: this.toProfileData(userId, dto),
    });

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
    await this.getByUserId(userId);
    if (dto.physiqueGoalId) {
      await this.ensurePhysiqueGoal(dto.physiqueGoalId);
    }

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
    };
  }

  private async ensurePhysiqueGoal(id: string) {
    const goal = await this.prisma.physiqueGoal.findUnique({ where: { id } });
    if (!goal) {
      throw new NotFoundException('Physique goal not found');
    }
  }
}
