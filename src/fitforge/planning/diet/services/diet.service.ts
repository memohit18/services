import { Injectable, NotFoundException } from '@nestjs/common';
import type { DietPlan } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { CreateDietDto } from '../dto/create-diet.dto';

@Injectable()
export class DietService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateDietDto) {
    const latest = await this.prisma.dietPlan.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const plan = await this.prisma.dietPlan.create({
      data: {
        userId,
        version,
        status: 'draft',
        goal: dto.goal,
        caloriesTarget: dto.caloriesTarget,
        proteinTarget: dto.proteinTarget,
        planJson: dto.planJson,
        aiPrompt: dto.aiPrompt,
        generatedBy: 'manual',
      },
    });

    return plan;
  }

  async getActive(userId: string) {
    const cacheKey = FitForgeCacheKeys.activeDiet(userId);
    const cached = await this.redis.get<DietPlan>(cacheKey);
    if (cached) {
      return cached;
    }

    const plan = await this.prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (!plan) {
      throw new NotFoundException('No active diet plan');
    }

    await this.redis.set(cacheKey, plan, FitForgeCacheTTL.ACTIVE_PLAN);
    return plan;
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.dietPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { version: 'desc' },
      }),
      this.prisma.dietPlan.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async activate(userId: string, id: string) {
    const plan = await this.prisma.dietPlan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException('Diet plan not found');
    }

    await this.prisma.$transaction([
      this.prisma.dietPlan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      }),
      this.prisma.dietPlan.update({
        where: { id },
        data: { status: 'active', startDate: new Date() },
      }),
    ]);

    await this.redis.del(FitForgeCacheKeys.activeDiet(userId));
    return this.prisma.dietPlan.findUnique({ where: { id } });
  }
}
