import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PhysiqueGoal, UserFitnessProfile } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AiWorkoutPlanService } from '../../../ai/generation/ai-workout-plan.service';
import { DietService } from '../../../planning/diet/services/diet.service';
import { TransformationService } from '../../../planning/transformation/services/transformation.service';
import { WorkoutsService } from '../../../training/workouts/services/workouts.service';
import { FitnessProfileService } from '../../fitness-profile/services/fitness-profile.service';
import { PhysiqueGoalsService } from '../../physique-goals/services/physique-goals.service';
import { UserOnboardingService } from '../../user-onboarding/services/user-onboarding.service';
import type { CreateFitnessProfileApiDto } from '../dto/fitness-profile-api.dto';
import type { UpdateFitnessProfileApiDto } from '../dto/fitness-profile-api.dto';
import {
  toFitnessGoalApi,
  toFitnessProfileApi,
  toGoalSlug,
  toInternalCreateDto,
  toInternalUpdateDto,
} from '../mappers/fitness-api.mapper';
import type { PlansSummary } from '../types/plans-summary';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FOCUS_AREA_LABELS: Record<string, string> = {
  fat_loss: 'Fat Loss',
  lean_bulk: 'Muscle Gain',
  muscle_gain: 'Muscle Gain',
  body_recomposition: 'Body Recomposition',
  recomposition: 'Body Recomposition',
  maintain_weight: 'Maintenance',
  maintenance: 'Maintenance',
};

@Injectable()
export class FitnessApiService {
  private readonly logger = new Logger(FitnessApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fitnessProfileService: FitnessProfileService,
    private readonly physiqueGoalsService: PhysiqueGoalsService,
    private readonly onboardingService: UserOnboardingService,
    private readonly transformationService: TransformationService,
    private readonly dietService: DietService,
    private readonly aiWorkoutPlanService: AiWorkoutPlanService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  async getGoals() {
    const goals = await this.physiqueGoalsService.findAll();
    return {
      goals: (goals as PhysiqueGoal[]).map(toFitnessGoalApi),
    };
  }

  /** Add a new physique goal (with imageUrl for onboarding cards). */
  async createGoal(dto: {
    title: string;
    description?: string;
    imageUrl: string;
    targetBodyFatMin?: number;
    targetBodyFatMax?: number;
  }) {
    const goal = await this.physiqueGoalsService.create({
      name: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      targetBodyFatMin: dto.targetBodyFatMin,
      targetBodyFatMax: dto.targetBodyFatMax,
    });
    return toFitnessGoalApi(goal);
  }

  /** Edit goal fields — usually update imageUrl after POST /images. */
  async updateGoal(
    idOrSlug: string,
    dto: {
      title?: string;
      description?: string;
      imageUrl?: string;
      targetBodyFatMin?: number;
      targetBodyFatMax?: number;
    },
  ) {
    const goal = await this.physiqueGoalsService.update(idOrSlug, {
      name: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      targetBodyFatMin: dto.targetBodyFatMin,
      targetBodyFatMax: dto.targetBodyFatMax,
    });
    return toFitnessGoalApi(goal);
  }

  async getProfile(userId: string) {
    const profile = await this.fitnessProfileService.getByUserId(userId);
    return this.buildProfileResponse(userId, profile);
  }

  async getPlans(userId: string): Promise<PlansSummary> {
    const profile = await this.fitnessProfileService.getByUserId(userId);
    const existing = await this.prisma.transformationTarget.findFirst({
      where: { userId, status: 'active' },
      select: { id: true },
    });
    if (!existing) {
      await this.onboardingService.complete(userId);
      await this.transformationService.generate(userId);
      void this.generateDownstreamPlans(userId);
    }

    const physiqueGoal = await this.prisma.physiqueGoal.findUnique({
      where: { id: profile.physiqueGoalId },
    });
    return this.buildPlansSummary(userId, profile, physiqueGoal);
  }

  async createProfile(userId: string, dto: CreateFitnessProfileApiDto) {
    const physiqueGoalUuid = await this.resolvePhysiqueGoalId(dto.physiqueGoalId);
    const internalDto = toInternalCreateDto({
      ...dto,
      physiqueGoalId: physiqueGoalUuid,
    });

    const profile = await this.fitnessProfileService.create(userId, internalDto);

    if (dto.onboardingCompleted) {
      await this.finalizeOnboarding(userId);
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
      await this.finalizeOnboarding(userId);
    }

    return this.buildProfileResponse(userId, profile);
  }

  private async finalizeOnboarding(userId: string) {
    await this.onboardingService.complete(userId);
    await this.transformationService.generate(userId);
    // Diet/workout AI can be slow — do not block the plan-ready response.
    void this.generateDownstreamPlans(userId);
  }

  private async generateDownstreamPlans(userId: string) {
    try {
      await this.dietService.generate(userId);
      this.logger.log(`Diet plan generated after onboarding for ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Diet generation after onboarding failed for ${userId}: ${String(error)}`,
      );
    }

    try {
      const workoutPlan = await this.aiWorkoutPlanService.generate(userId);
      await this.workoutsService.activate(userId, workoutPlan.id);
      this.logger.log(`Workout plan generated after onboarding for ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Workout generation after onboarding failed for ${userId}: ${String(error)}`,
      );
    }
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

    const base = toFitnessProfileApi(
      profile,
      onboarding.isCompleted,
      physiqueGoal,
    );

    if (!onboarding.isCompleted) {
      return base;
    }

    const plans = await this.buildPlansSummary(userId, profile, physiqueGoal);
    return { ...base, plans };
  }

  private async buildPlansSummary(
    userId: string,
    profile: UserFitnessProfile,
    physiqueGoal: PhysiqueGoal | null,
  ): Promise<PlansSummary> {
    const [transformation, dietPlan, workoutPlan] = await Promise.all([
      this.prisma.transformationTarget.findFirst({
        where: { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dietPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
        select: { id: true },
      }),
      this.prisma.workoutPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
        select: { id: true, daysPerWeek: true, goal: true },
      }),
    ]);

    const calories = transformation?.dailyCalorieTarget ?? 0;
    const protein = transformation?.proteinTarget ?? 0;
    const daysPerWeek =
      workoutPlan?.daysPerWeek ?? profile.workoutDaysPerWeek ?? 3;
    const fitnessGoalApi =
      workoutPlan?.goal ??
      profile.fitnessGoal ??
      'fat_loss';
    const focusArea =
      physiqueGoal?.name ??
      FOCUS_AREA_LABELS[fitnessGoalApi] ??
      this.humanize(fitnessGoalApi);

    const nutritionReady = calories > 0 && protein > 0;
    const workoutReady = daysPerWeek > 0 && Boolean(focusArea);

    return {
      nutrition: {
        dailyTarget: nutritionReady ? `${calories.toLocaleString()} kcal` : 'Coming soon',
        proteinGoal: nutritionReady ? `${protein} g` : 'Coming soon',
        calories,
        protein,
        ready: nutritionReady,
      },
      workout: {
        frequency: workoutReady ? `${daysPerWeek} days/week` : 'Coming soon',
        focusArea: workoutReady ? focusArea : 'Coming soon',
        daysPerWeek,
        fitnessGoal: fitnessGoalApi,
        ready: workoutReady,
      },
      ready: nutritionReady && workoutReady,
      transformationId: transformation?.id ?? null,
      dietPlanId: dietPlan?.id ?? null,
      workoutPlanId: workoutPlan?.id ?? null,
    };
  }

  private humanize(value: string): string {
    return value
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
