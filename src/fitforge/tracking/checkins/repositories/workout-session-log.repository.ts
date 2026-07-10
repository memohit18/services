import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class WorkoutSessionLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.WorkoutSessionLogCreateInput) {
    return this.prisma.workoutSessionLog.create({ data });
  }

  findForDay(userId: string, start: Date, end: Date) {
    return this.prisma.workoutSessionLog.findMany({
      where: {
        userId,
        OR: [
          { completedAt: { gte: start, lt: end } },
          {
            completedAt: null,
            createdAt: { gte: start, lt: end },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        workoutPlanDay: {
          select: {
            id: true,
            dayNumber: true,
            title: true,
            workoutPlanId: true,
          },
        },
      },
    });
  }
}
