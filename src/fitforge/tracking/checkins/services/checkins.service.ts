import { ConflictException, Injectable } from '@nestjs/common';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse, successResponse } from '../../../../common/utils/api-response';
import { DietService } from '../../../planning/diet/services/diet.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { WorkoutsService } from '../../../training/workouts/services/workouts.service';
import { CreateCheckinDto } from '../dto/create-checkin.dto';

@Injectable()
export class CheckinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dietService: DietService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  async checkin(userId: string, dto: CreateCheckinDto) {
    const checkInDate = startOfDay(new Date());

    const existing = await this.prisma.dailyCheckin.findUnique({
      where: { userId_checkInDate: { userId, checkInDate } },
    });
    if (existing) {
      throw new ConflictException('Check-in already exists for today');
    }

    let dietPlanId: string | undefined;
    let workoutPlanId: string | undefined;
    try {
      dietPlanId = (await this.dietService.getActive(userId)).id;
    } catch {
      dietPlanId = undefined;
    }
    try {
      workoutPlanId = (await this.workoutsService.getActive(userId)).id;
    } catch {
      workoutPlanId = undefined;
    }

    const mealsAssigned = (dto.mealsCompleted ?? 0) + (dto.mealsSkipped ?? 0);
    const dietCompliance =
      mealsAssigned > 0
        ? Math.round(((dto.mealsCompleted ?? 0) / mealsAssigned) * 100)
        : 0;

    return this.prisma.dailyCheckin.create({
      data: {
        userId,
        checkInDate,
        dietPlanId,
        workoutPlanId,
        weightKg: dto.weightKg,
        caloriesConsumed: dto.caloriesConsumed,
        proteinConsumed: dto.proteinConsumed,
        waterIntakeMl: dto.waterIntakeMl,
        mealsCompleted: dto.mealsCompleted ?? 0,
        mealsSkipped: dto.mealsSkipped ?? 0,
        dietCompliance,
        workoutCompleted: dto.workoutCompleted ?? false,
      },
    });
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.dailyCheckin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkInDate: 'desc' },
      }),
      this.prisma.dailyCheckin.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getMonthlyStats(userId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const checkins = await this.prisma.dailyCheckin.findMany({
      where: {
        userId,
        checkInDate: { gte: start, lte: end },
      },
    });

    const totalDays = checkins.length;
    const avgCompliance =
      totalDays > 0
        ? Math.round(
            checkins.reduce((sum, c) => sum + (c.dietCompliance ?? 0), 0) / totalDays,
          )
        : 0;
    const workoutsCompleted = checkins.filter((c) => c.workoutCompleted).length;

    return successResponse({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalCheckins: totalDays,
      avgDietCompliance: avgCompliance,
      workoutsCompleted,
      avgCalories:
        totalDays > 0
          ? Math.round(
              checkins.reduce((sum, c) => sum + (c.caloriesConsumed ?? 0), 0) / totalDays,
            )
          : 0,
      avgProtein:
        totalDays > 0
          ? Math.round(
              checkins.reduce((sum, c) => sum + (c.proteinConsumed ?? 0), 0) / totalDays,
            )
          : 0,
    }).data;
  }
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
