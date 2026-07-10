import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../prisma/prisma.service';

@Injectable()
export class WorkoutLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, userId: string) {
    return this.prisma.workoutLog.findFirst({ where: { id, userId } });
  }

  findSetsForExercise(
    userId: string,
    sessionId: string,
    workoutPlanExerciseId: string,
  ) {
    return this.prisma.workoutLog.findMany({
      where: {
        userId,
        workoutSessionId: sessionId,
        workoutPlanExerciseId,
        setNumber: { not: null },
      },
      orderBy: { setNumber: 'asc' },
    });
  }

  findForSession(sessionId: string, userId: string) {
    return this.prisma.workoutLog.findMany({
      where: { workoutSessionId: sessionId, userId },
      orderBy: [{ workoutPlanExerciseId: 'asc' }, { setNumber: 'asc' }],
      include: {
        workoutPlanExercise: { include: { exercise: true } },
      },
    });
  }

  nextSetNumber(
    userId: string,
    sessionId: string,
    workoutPlanExerciseId: string,
  ) {
    return this.prisma.workoutLog
      .aggregate({
        where: {
          userId,
          workoutSessionId: sessionId,
          workoutPlanExerciseId,
          setNumber: { not: null },
        },
        _max: { setNumber: true },
      })
      .then((r) => (r._max.setNumber ?? 0) + 1);
  }

  create(data: Prisma.WorkoutLogCreateInput) {
    return this.prisma.workoutLog.create({
      data,
      include: {
        workoutPlanExercise: { include: { exercise: true } },
      },
    });
  }

  update(id: string, data: Prisma.WorkoutLogUpdateInput) {
    return this.prisma.workoutLog.update({
      where: { id },
      data,
      include: {
        workoutPlanExercise: { include: { exercise: true } },
      },
    });
  }

  findExerciseCompletionLogs(sessionId: string, workoutPlanExerciseId: string) {
    return this.prisma.workoutLog.findMany({
      where: {
        workoutSessionId: sessionId,
        workoutPlanExerciseId,
        OR: [
          { status: 'completed', setNumber: null },
          { status: 'skipped', setNumber: null },
        ],
      },
    });
  }
}
