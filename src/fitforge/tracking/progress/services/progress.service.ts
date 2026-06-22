import { Injectable, NotFoundException } from '@nestjs/common';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse, successResponse } from '../../../../common/utils/api-response';
import { FitnessProfileService } from '../../../onboarding/fitness-profile/services/fitness-profile.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateProgressDto } from '../dto/create-progress.dto';
import { UpdateProgressDto } from '../dto/update-progress.dto';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fitnessProfileService: FitnessProfileService,
  ) {}

  async create(userId: string, dto: CreateProgressDto) {
    return this.prisma.progressLog.create({
      data: { userId, ...dto },
    });
  }

  async update(userId: string, id: string, dto: UpdateProgressDto) {
    const log = await this.prisma.progressLog.findFirst({ where: { id, userId } });
    if (!log) {
      throw new NotFoundException('Progress log not found');
    }
    return this.prisma.progressLog.update({ where: { id }, data: dto });
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.progressLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.progressLog.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getAnalytics(userId: string) {
    const logs = await this.prisma.progressLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return successResponse({
        weightChange: 0,
        waistChange: 0,
        bodyFatChange: 0,
        goalCompletion: 0,
      }).data;
    }

    const first = logs[0];
    const last = logs[logs.length - 1];

    let goalCompletion = 0;
    try {
      const profile = await this.fitnessProfileService.getByUserId(userId);
      if (profile.targetWeightKg && last.weightKg != null) {
        const totalDelta = profile.weightKg - profile.targetWeightKg;
        const currentDelta = profile.weightKg - last.weightKg;
        goalCompletion =
          totalDelta === 0
            ? 100
            : Math.min(100, Math.max(0, Math.round((currentDelta / totalDelta) * 100)));
      }
    } catch {
      goalCompletion = 0;
    }

    return {
      weightChange: diff(last.weightKg, first.weightKg),
      waistChange: diff(last.waistCm, first.waistCm),
      bodyFatChange: diff(last.bodyFatPercentage, first.bodyFatPercentage),
      goalCompletion,
    };
  }
}

function diff(latest?: number | null, earliest?: number | null) {
  if (latest == null || earliest == null) {
    return 0;
  }
  return Math.round((latest - earliest) * 10) / 10;
}
