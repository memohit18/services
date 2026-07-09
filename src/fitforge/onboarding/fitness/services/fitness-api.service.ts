import { Injectable, NotFoundException } from '@nestjs/common';
import type { PhysiqueGoal } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FitnessProfileService } from '../../fitness-profile/services/fitness-profile.service';
import { PhysiqueGoalsService } from '../../physique-goals/services/physique-goals.service';
import { UserOnboardingService } from '../../user-onboarding/services/user-onboarding.service';
import { TransformationService } from '../../../planning/transformation/services/transformation.service';
import type { CreateFitnessProfileApiDto } from '../dto/fitness-profile-api.dto';
import type { UpdateFitnessProfileApiDto } from '../dto/fitness-profile-api.dto';
import {
  toFitnessGoalApi,
  toFitnessProfileApi,
  toGoalSlug,
  toInternalCreateDto,
  toInternalUpdateDto,
} from '../mappers/fitness-api.mapper';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class FitnessApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fitnessProfileService: FitnessProfileService,
    private readonly physiqueGoalsService: PhysiqueGoalsService,
    private readonly onboardingService: UserOnboardingService,
    private readonly transformationService: TransformationService,
  ) {}

  async getGoals() {
    const goals = await this.physiqueGoalsService.findAll();
    return {
      goals: (goals as PhysiqueGoal[]).map(toFitnessGoalApi),
    };
  }

  async getProfile(userId: string) {
    const profile = await this.fitnessProfileService.getByUserId(userId);
    return this.buildProfileResponse(userId, profile);
  }

  async createProfile(userId: string, dto: CreateFitnessProfileApiDto) {
    const physiqueGoalUuid = await this.resolvePhysiqueGoalId(dto.physiqueGoalId);
    const internalDto = toInternalCreateDto({
      ...dto,
      physiqueGoalId: physiqueGoalUuid,
    });

    const profile = await this.fitnessProfileService.create(userId, internalDto);

    if (dto.onboardingCompleted) {
      await this.onboardingService.complete(userId);
      await this.transformationService.generate(userId);
    }

    return this.buildProfileResponse(userId, profile);
  }

  async updateProfile(userId: string, dto: UpdateFitnessProfileApiDto) {
    const internalDto = toInternalUpdateDto(dto);

    if (dto.physiqueGoalId != null) {
      internalDto.physiqueGoalId = await this.resolvePhysiqueGoalId(
        dto.physiqueGoalId,
      );
    }

    const profile = await this.fitnessProfileService.update(userId, internalDto);

    if (dto.onboardingCompleted) {
      await this.onboardingService.complete(userId);
      await this.transformationService.generate(userId);
    }

    return this.buildProfileResponse(userId, profile);
  }

  private async buildProfileResponse(
    userId: string,
    profile: Awaited<ReturnType<FitnessProfileService['getByUserId']>>,
  ) {
    const [onboarding, physiqueGoal] = await Promise.all([
      this.onboardingService.getOrCreate(userId),
      this.prisma.physiqueGoal.findUnique({
        where: { id: profile.physiqueGoalId },
      }),
    ]);

    return toFitnessProfileApi(
      profile,
      onboarding.isCompleted,
      physiqueGoal,
    );
  }

  private async resolvePhysiqueGoalId(idOrSlug: string): Promise<string> {
    if (UUID_REGEX.test(idOrSlug)) {
      const goal = await this.prisma.physiqueGoal.findUnique({
        where: { id: idOrSlug },
      });
      if (!goal) {
        throw new NotFoundException('Physique goal not found');
      }
      return goal.id;
    }

    const goals = await this.physiqueGoalsService.findAll();
    const normalized = idOrSlug.toLowerCase();
    const match = (goals as PhysiqueGoal[]).find(
      (g) => toGoalSlug(g.name) === normalized,
    );
    if (!match) {
      throw new NotFoundException('Physique goal not found');
    }
    return match.id;
  }
}
