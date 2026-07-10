import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../prisma/prisma.service';

const ACTIVE_STATUSES = ['in_progress', 'paused', 'partial'] as const;

@Injectable()
export class WorkoutSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, userId: string) {
    return this.prisma.workoutSessionLog.findFirst({
      where: { id, userId },
      include: {
        workoutPlanDay: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { sortOrder: 'asc' },
            },
            workoutPlan: { select: { id: true, userId: true, goal: true } },
          },
        },
        exerciseLogs: {
          include: {
            workoutPlanExercise: { include: { exercise: true } },
          },
          orderBy: [{ workoutPlanExerciseId: 'asc' }, { setNumber: 'asc' }],
        },
      },
    });
  }

  findActive(userId: string) {
    return this.prisma.workoutSessionLog.findFirst({
      where: { userId, status: { in: [...ACTIVE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      include: {
        workoutPlanDay: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  create(data: Prisma.WorkoutSessionLogCreateInput) {
    return this.prisma.workoutSessionLog.create({ data });
  }

  update(id: string, data: Prisma.WorkoutSessionLogUpdateInput) {
    return this.prisma.workoutSessionLog.update({ where: { id }, data });
  }

  findHistory(userId: string, skip: number, take: number) {
    const where = { userId, status: { in: ['completed', 'partial', 'skipped'] } };
    return Promise.all([
      this.prisma.workoutSessionLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          workoutPlanDay: {
            select: { id: true, dayNumber: true, title: true },
          },
        },
      }),
      this.prisma.workoutSessionLog.count({ where }),
    ]);
  }
}
