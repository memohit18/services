import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { startOfLocalCalendarDay } from '../../../../tracking/checkins/aggregator/daily-aggregator.engine';
import { DailyAggregatorService } from '../../../../tracking/checkins/services/daily-aggregator.service';
import { EndWorkoutSessionDto } from '../dto/end-session.dto';
import { StartWorkoutSessionDto } from '../dto/start-session.dto';
import { WorkoutSessionRepository } from '../repositories/workout-session.repository';
import { WorkoutAnalyticsService } from './workout-analytics.service';

function startOfUtcDay(date: Date | string = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

@Injectable()
export class WorkoutSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: WorkoutSessionRepository,
    private readonly analytics: WorkoutAnalyticsService,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  async getToday(userId: string) {
    const day = await this.resolveTodayPlanDay(userId);
    const active = await this.sessions.findActive(userId);
    return {
      date: startOfUtcDay().toISOString().slice(0, 10),
      workoutPlanDay: day
        ? {
            id: day.id,
            dayNumber: day.dayNumber,
            title: day.title,
            workoutPlanId: day.workoutPlanId,
            exercises: day.exercises.map((e) => ({
              id: e.id,
              name: e.exercise.name,
              sets: e.sets,
              reps: e.reps,
              restSeconds: e.restSeconds,
              sortOrder: e.sortOrder,
            })),
          }
        : null,
      activeSession: active
        ? {
            sessionId: active.id,
            status: active.status,
            workoutPlanDayId: active.workoutPlanDayId,
            createdAt: active.createdAt,
            pausedAt: active.pausedAt,
          }
        : null,
    };
  }

  async getActiveSession(userId: string) {
    const session = await this.sessions.findActive(userId);
    if (!session) {
      return null;
    }
    return this.getSessionDetail(userId, session.id);
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.sessions.findHistory(userId, skip, limit);
    return {
      items: items.map((s) => ({
        id: s.id,
        status: s.status,
        durationMinutes: s.durationMinutes,
        caloriesBurned: s.caloriesBurned,
        workoutPlanDay: s.workoutPlanDay,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getSessionDetail(userId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId, userId);
    if (!session) {
      throw new NotFoundException('Workout session not found');
    }
    const analytics = this.analytics.fromSession(session);
    return { session, analytics };
  }

  async start(userId: string, dto: StartWorkoutSessionDto) {
    const existing = await this.sessions.findActive(userId);
    if (existing) {
      if (existing.status === 'paused') {
        throw new BadRequestException(
          'A paused workout session already exists. Resume or end it first.',
        );
      }
      return {
        sessionId: existing.id,
        session: existing,
        resumed: true,
        message: 'Resumed existing in-progress session',
      };
    }

    let workoutPlanDayId = dto.workoutPlanDayId;
    if (workoutPlanDayId) {
      await this.assertDayOwned(userId, workoutPlanDayId);
    } else {
      const today = await this.resolveTodayPlanDay(userId);
      if (!today) {
        throw new NotFoundException(
          'No workout day for today. Pass workoutPlanDayId or activate a plan.',
        );
      }
      workoutPlanDayId = today.id;
    }

    const session = await this.sessions.create({
      user: { connect: { id: userId } },
      workoutPlanDay: { connect: { id: workoutPlanDayId } },
      status: 'in_progress',
      totalPausedSeconds: 0,
    });

    return { sessionId: session.id, session, resumed: false };
  }

  async pause(userId: string, sessionId?: string) {
    const session = await this.requireActiveSession(userId, sessionId);
    if (session.status === 'paused') {
      return { sessionId: session.id, session, alreadyPaused: true };
    }
    if (session.status !== 'in_progress' && session.status !== 'partial') {
      throw new BadRequestException('Only an active session can be paused');
    }

    const updated = await this.sessions.update(session.id, {
      status: 'paused',
      pausedAt: new Date(),
    });
    return { sessionId: updated.id, session: updated, alreadyPaused: false };
  }

  async resume(userId: string, sessionId?: string) {
    const session = sessionId
      ? await this.sessions.findById(sessionId, userId)
      : await this.sessions.findActive(userId);
    if (!session) {
      throw new NotFoundException('Workout session not found');
    }
    if (session.status !== 'paused') {
      throw new BadRequestException('Session is not paused');
    }

    let totalPausedSeconds = session.totalPausedSeconds ?? 0;
    if (session.pausedAt) {
      totalPausedSeconds += Math.max(
        0,
        Math.round((Date.now() - session.pausedAt.getTime()) / 1000),
      );
    }

    const updated = await this.sessions.update(session.id, {
      status: 'in_progress',
      pausedAt: null,
      totalPausedSeconds,
    });
    return { sessionId: updated.id, session: updated };
  }

  async end(userId: string, dto: EndWorkoutSessionDto) {
    const session = await this.requireActiveSession(userId, dto.sessionId);
    const detail = await this.sessions.findById(session.id, userId);
    if (!detail) {
      throw new NotFoundException('Workout session not found');
    }

    const planned = detail.workoutPlanDay?.exercises ?? [];
    const { completedIds, skippedIds } = this.analytics.exerciseOutcomes(
      detail.exerciseLogs,
    );
    const unresolved = planned.filter(
      (e) => !completedIds.has(e.id) && !skippedIds.has(e.id),
    );

    if (unresolved.length > 0 && !dto.force) {
      throw new BadRequestException(
        `Cannot finish workout: ${unresolved.length} exercise(s) still incomplete. Complete, skip, or pass force=true.`,
      );
    }

    if (unresolved.length > 0 && dto.force) {
      for (const exercise of unresolved) {
        await this.prisma.workoutLog.create({
          data: {
            userId,
            workoutPlanExerciseId: exercise.id,
            workoutSessionId: session.id,
            status: 'skipped',
            completedAt: new Date(),
            notes: 'Auto-skipped on force finish',
          },
        });
      }
    }

    let totalPausedSeconds = detail.totalPausedSeconds ?? 0;
    if (detail.status === 'paused' && detail.pausedAt) {
      totalPausedSeconds += Math.max(
        0,
        Math.round((Date.now() - detail.pausedAt.getTime()) / 1000),
      );
    }

    const completedAt = new Date();
    const durationMinutes =
      dto.durationMinutes ??
      this.analytics.effectiveDuration(
        detail.createdAt,
        completedAt,
        totalPausedSeconds,
      );

    const updated = await this.sessions.update(session.id, {
      status: unresolved.length > 0 && dto.force ? 'partial' : 'completed',
      completedAt,
      durationMinutes,
      caloriesBurned: dto.caloriesBurned ?? detail.caloriesBurned,
      totalPausedSeconds,
      pausedAt: null,
    });

    const checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(completedAt),
    );

    const full = await this.sessions.findById(updated.id, userId);
    return {
      session: updated,
      analytics: full ? this.analytics.fromSession(full) : null,
      checkin,
    };
  }

  private async requireActiveSession(userId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.sessions.findById(sessionId, userId);
      if (!session) {
        throw new NotFoundException('Workout session not found');
      }
      return session;
    }
    const active = await this.sessions.findActive(userId);
    if (!active) {
      throw new NotFoundException('No active workout session');
    }
    return active;
  }

  private async assertDayOwned(userId: string, workoutPlanDayId: string) {
    const day = await this.prisma.workoutDay.findUnique({
      where: { id: workoutPlanDayId },
      include: { workoutPlan: { select: { userId: true } } },
    });
    if (!day || day.workoutPlan.userId !== userId) {
      throw new NotFoundException('Workout plan day not found');
    }
    return day;
  }

  private async resolveTodayPlanDay(userId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!plan || plan.days.length === 0) {
      return null;
    }

    const maxDay = plan.days.reduce((m, d) => Math.max(m, d.dayNumber), 1);
    const jsDay = new Date().getUTCDay();
    const weekday = jsDay === 0 ? 7 : jsDay;
    const dayNumber = ((weekday - 1) % maxDay) + 1;
    return (
      plan.days.find((d) => d.dayNumber === dayNumber) ?? plan.days[0] ?? null
    );
  }
}
