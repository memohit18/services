import { Injectable, NotFoundException } from '@nestjs/common';
import type { WorkoutPlan } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { CreateWorkoutDto } from '../dto/create-workout.dto';

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

    return this.prisma.workoutPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: dto.goal,
        daysPerWeek: dto.daysPerWeek,
        planJson: dto.planJson,
        aiPrompt: dto.aiPrompt,
        generatedBy: 'manual',
      },
    });
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeWorkout(userId);
    const cached = await this.redis.get<WorkoutPlan>(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
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
    return this.prisma.workoutPlan.findUnique({ where: { id } });
  }
}
