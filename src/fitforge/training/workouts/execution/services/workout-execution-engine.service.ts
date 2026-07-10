import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { CompleteExerciseDto } from '../dto/complete-exercise.dto';
import { LogWorkoutSetDto } from '../dto/log-set.dto';
import { UpdateWorkoutSetDto } from '../dto/update-set.dto';
import { WorkoutLogRepository } from '../repositories/workout-log.repository';
import { WorkoutSessionRepository } from '../repositories/workout-session.repository';
import { WorkoutAnalyticsService } from './workout-analytics.service';

@Injectable()
export class WorkoutExecutionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: WorkoutSessionRepository,
    private readonly logs: WorkoutLogRepository,
    private readonly analytics: WorkoutAnalyticsService,
  ) {}

  async logSet(
    userId: string,
    exerciseId: string,
    dto: LogWorkoutSetDto,
  ) {
    const session = await this.requireOpenSession(userId, dto.sessionId);
    const exercise = await this.assertExerciseInSession(
      userId,
      session.id,
      exerciseId,
    );

    if (session.status === 'paused') {
      throw new BadRequestException('Resume the workout before logging sets');
    }

    const setNumber =
      dto.setNumber ??
      (await this.logs.nextSetNumber(userId, session.id, exerciseId));

    if (setNumber > exercise.sets + 2) {
      throw new BadRequestException(
        `Set number ${setNumber} exceeds planned sets (${exercise.sets})`,
      );
    }

    const log = await this.logs.create({
      user: { connect: { id: userId } },
      workoutPlanExercise: { connect: { id: exerciseId } },
      workoutSession: { connect: { id: session.id } },
      setNumber,
      completedReps: dto.reps,
      completedWeight: dto.weight,
      restSeconds: dto.restSeconds ?? exercise.restSeconds,
      notes: dto.notes,
      status: 'completed',
      completedAt: new Date(),
      completedSets: 1,
    });

    if (session.status === 'in_progress') {
      await this.sessions.update(session.id, { status: 'partial' });
    }

    return {
      setId: log.id,
      set: log,
      restTimerSeconds: log.restSeconds ?? exercise.restSeconds,
    };
  }

  async updateSet(
    userId: string,
    exerciseId: string,
    setId: string,
    dto: UpdateWorkoutSetDto,
  ) {
    const log = await this.logs.findById(setId, userId);
    if (!log || log.workoutPlanExerciseId !== exerciseId) {
      throw new NotFoundException('Set log not found');
    }
    if (log.setNumber == null) {
      throw new BadRequestException('Not a set log');
    }

    const updated = await this.logs.update(setId, {
      ...(dto.reps !== undefined ? { completedReps: dto.reps } : {}),
      ...(dto.weight !== undefined ? { completedWeight: dto.weight } : {}),
      ...(dto.restSeconds !== undefined
        ? { restSeconds: dto.restSeconds }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    return { setId: updated.id, set: updated };
  }

  async completeExercise(
    userId: string,
    exerciseId: string,
    dto: CompleteExerciseDto,
  ) {
    const session = await this.requireOpenSession(userId, dto.sessionId);
    await this.assertExerciseInSession(userId, session.id, exerciseId);

    if (session.status === 'paused') {
      throw new BadRequestException(
        'Resume the workout before completing an exercise',
      );
    }

    const existing = await this.logs.findExerciseCompletionLogs(
      session.id,
      exerciseId,
    );
    if (existing.length > 0) {
      throw new BadRequestException('Exercise already completed or skipped');
    }

    const sets = await this.logs.findSetsForExercise(
      userId,
      session.id,
      exerciseId,
    );

    const status = dto.skip ? 'skipped' : 'completed';
    if (!dto.skip && sets.length === 0) {
      throw new BadRequestException(
        'Log at least one set before completing, or pass skip=true',
      );
    }

    const summary = await this.logs.create({
      user: { connect: { id: userId } },
      workoutPlanExercise: { connect: { id: exerciseId } },
      workoutSession: { connect: { id: session.id } },
      setNumber: null,
      completedSets: sets.length,
      completedReps: sets.map((s) => s.completedReps).filter(Boolean).join(','),
      completedWeight:
        sets.length > 0
          ? sets.reduce((sum, s) => sum + (s.completedWeight ?? 0), 0) /
            sets.length
          : null,
      durationMinutes: dto.durationMinutes,
      notes: dto.notes,
      status,
      completedAt: new Date(),
    });

    if (session.status === 'in_progress') {
      await this.sessions.update(session.id, { status: 'partial' });
    }

    const detail = await this.sessions.findById(session.id, userId);
    return {
      exerciseId,
      status,
      summary,
      setsLogged: sets.length,
      analytics: detail ? this.analytics.fromSession(detail) : null,
    };
  }

  private async requireOpenSession(userId: string, sessionId?: string) {
    const session = sessionId
      ? await this.sessions.findById(sessionId, userId)
      : await this.sessions.findActive(userId);
    if (!session) {
      throw new NotFoundException('No active workout session');
    }
    if (!['in_progress', 'paused', 'partial'].includes(session.status)) {
      throw new BadRequestException('Session is closed');
    }
    return session;
  }

  private async assertExerciseInSession(
    userId: string,
    sessionId: string,
    exerciseId: string,
  ) {
    const session = await this.sessions.findById(sessionId, userId);
    if (!session) {
      throw new NotFoundException('Workout session not found');
    }
    const exercise = session.workoutPlanDay?.exercises.find(
      (e) => e.id === exerciseId,
    );
    if (!exercise) {
      // Allow logging against any owned exercise if day not linked
      const owned = await this.prisma.workoutExercise.findUnique({
        where: { id: exerciseId },
        include: {
          workoutDay: {
            include: { workoutPlan: { select: { userId: true } } },
          },
        },
      });
      if (!owned || owned.workoutDay.workoutPlan.userId !== userId) {
        throw new NotFoundException('Workout exercise not found');
      }
      return owned;
    }
    return exercise;
  }
}
