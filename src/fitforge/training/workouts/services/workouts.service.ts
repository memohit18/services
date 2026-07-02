import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { CreateWorkoutDayDto } from '../dto/create-workout-day.dto';
import { CreateWorkoutExerciseDto } from '../dto/create-workout-exercise.dto';
import { CreateWorkoutDto } from '../dto/create-workout.dto';

const workoutPlanInclude = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      exercises: {
        include: { exercise: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
};

type WorkoutPlanWithDays = Awaited<
  ReturnType<WorkoutsService['findPlanWithDays']>
>;

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateWorkoutDto) {
    const latest = await this.prisma.workoutPlan.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    if (dto.days?.length) {
      const exerciseIds = dto.days.flatMap(
        (day) => day.exercises?.map((exercise) => exercise.exerciseId) ?? [],
      );
      if (exerciseIds.length) {
        await this.ensureExercisesExist(exerciseIds);
      }
    }

    const plan = await this.prisma.workoutPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: dto.goal,
        daysPerWeek: dto.daysPerWeek,
        aiPrompt: dto.aiPrompt,
        generatedBy: 'manual',
        days: dto.days?.length
          ? {
              create: dto.days.map((day) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                exercises: day.exercises?.length
                  ? {
                      create: day.exercises.map((exercise) => ({
                        exerciseId: exercise.exerciseId,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restSeconds: exercise.restSeconds,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: workoutPlanInclude,
    });

    return plan;
  }

  async addDay(userId: string, planId: string, dto: CreateWorkoutDayDto) {
    await this.ensurePlan(userId, planId);
    if (dto.exercises?.length) {
      await this.ensureExercisesExist(dto.exercises.map((e) => e.exerciseId));
    }

    return this.prisma.workoutDay.create({
      data: {
        workoutPlanId: planId,
        dayNumber: dto.dayNumber,
        title: dto.title,
        exercises: dto.exercises?.length
          ? {
              create: dto.exercises.map((exercise) => ({
                exerciseId: exercise.exerciseId,
                sets: exercise.sets,
                reps: exercise.reps,
                restSeconds: exercise.restSeconds,
              })),
            }
          : undefined,
      },
      include: {
        exercises: { include: { exercise: true } },
      },
    });
  }

  async addExercise(
    userId: string,
    planId: string,
    dayId: string,
    dto: CreateWorkoutExerciseDto,
  ) {
    await this.ensurePlan(userId, planId);
    const day = await this.prisma.workoutDay.findFirst({
      where: { id: dayId, workoutPlanId: planId },
    });
    if (!day) {
      throw new NotFoundException('Workout day not found');
    }
    await this.ensureExercisesExist([dto.exerciseId]);

    return this.prisma.workoutExercise.create({
      data: {
        workoutDayId: dayId,
        exerciseId: dto.exerciseId,
        sets: dto.sets,
        reps: dto.reps,
        restSeconds: dto.restSeconds,
      },
      include: { exercise: true },
    });
  }

  async getById(userId: string, id: string) {
    return this.findPlanWithDays(userId, id);
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeWorkout(userId);
    const cached = await this.redis.get<WorkoutPlanWithDays>(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: workoutPlanInclude,
    });
    if (!plan) {
      throw new NotFoundException('No active workout plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.workoutPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { version: 'desc' },
      }),
      this.prisma.workoutPlan.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async activate(userId: string, id: string) {
    const plan = await this.prisma.workoutPlan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Workout plan not found');
    }

    await this.prisma.$transaction([
      this.prisma.workoutPlan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      }),
      this.prisma.workoutPlan.update({
        where: { id },
        data: { status: 'active', startDate: new Date() },
      }),
    ]);

    await this.redis.del(FitForgeCacheKeys.activeWorkout(userId));
    return this.findPlanWithDays(userId, id);
  }

  private async findPlanWithDays(userId: string, id: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id, userId },
      include: workoutPlanInclude,
    });
    if (!plan) {
      throw new NotFoundException('Workout plan not found');
    }
    return plan;
  }

  private async ensurePlan(userId: string, planId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) {
      throw new NotFoundException('Workout plan not found');
    }
    return plan;
  }

  private async ensureExercisesExist(exerciseIds: string[]) {
    const uniqueIds = [...new Set(exerciseIds)];
    const count = await this.prisma.exerciseMaster.count({
      where: { id: { in: uniqueIds } },
    });
    if (count !== uniqueIds.length) {
      throw new NotFoundException('One or more exercises not found');
    }
  }
}
