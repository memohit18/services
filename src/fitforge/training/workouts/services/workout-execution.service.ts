import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { startOfLocalCalendarDay } from '../../../tracking/checkins/aggregator/daily-aggregator.engine';
import { DailyAggregatorService } from '../../../tracking/checkins/services/daily-aggregator.service';
import { CompleteWorkoutExerciseDto } from '../dto/complete-workout-exercise.dto';
import { EndWorkoutSessionDto } from '../dto/end-workout-session.dto';
import { StartWorkoutSessionDto } from '../dto/start-workout-session.dto';

@Injectable()
export class WorkoutExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  async startSession(userId: string, dto: StartWorkoutSessionDto) {
    if (dto.workoutPlanDayId) {
      const day = await this.prisma.workoutDay.findUnique({
        where: { id: dto.workoutPlanDayId },
        include: { workoutPlan: { select: { userId: true } } },
      });
      if (!day || day.workoutPlan.userId !== userId) {
        throw new NotFoundException('Workout plan day not found');
      }
    }

    const open = await this.prisma.workoutSessionLog.findFirst({
      where: { userId, status: 'in_progress' },
      orderBy: { createdAt: 'desc' },
    });
    if (open) {
      return { sessionId: open.id, session: open, resumed: true };
    }

    const session = await this.prisma.workoutSessionLog.create({
      data: {
        userId,
        workoutPlanDayId: dto.workoutPlanDayId,
        status: 'in_progress',
      },
    });

    return { sessionId: session.id, session, resumed: false };
  }

  async endSession(userId: string, dto: EndWorkoutSessionDto) {
    const session = await this.prisma.workoutSessionLog.findFirst({
      where: { id: dto.sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Workout session not found');
    }
    if (session.status !== 'in_progress' && session.status !== 'partial') {
      throw new BadRequestException('Session is already closed');
    }

    const completedAt = new Date();
    const durationMinutes =
      dto.durationMinutes ??
      Math.max(
        1,
        Math.round(
          (completedAt.getTime() - session.createdAt.getTime()) / 60_000,
        ),
      );

    const updated = await this.prisma.workoutSessionLog.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        completedAt,
        durationMinutes,
        caloriesBurned: dto.caloriesBurned ?? session.caloriesBurned,
      },
    });

    const checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(completedAt),
    );

    return { session: updated, checkin };
  }

  async completeExercise(userId: string, dto: CompleteWorkoutExerciseDto) {
    const exercise = await this.prisma.workoutExercise.findUnique({
      where: { id: dto.workoutPlanExerciseId },
      include: {
        workoutDay: {
          include: { workoutPlan: { select: { userId: true } } },
        },
      },
    });
    if (!exercise || exercise.workoutDay.workoutPlan.userId !== userId) {
      throw new NotFoundException('Workout exercise not found');
    }

    if (dto.sessionId) {
      const session = await this.prisma.workoutSessionLog.findFirst({
        where: { id: dto.sessionId, userId },
      });
      if (!session) {
        throw new NotFoundException('Workout session not found');
      }
    }

    const log = await this.prisma.workoutLog.create({
      data: {
        userId,
        workoutPlanExerciseId: dto.workoutPlanExerciseId,
        completedSets: dto.sets,
        completedReps: dto.reps,
        completedWeight: dto.weight,
        durationMinutes: dto.duration,
        status: 'completed',
        completedAt: new Date(),
      },
      include: {
        workoutPlanExercise: {
          include: { exercise: true },
        },
      },
    });

    // Keep open session marked partial until end
    if (dto.sessionId) {
      await this.prisma.workoutSessionLog.updateMany({
        where: { id: dto.sessionId, userId, status: 'in_progress' },
        data: { status: 'partial' },
      });
    }

    const checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(),
    );

    return { log, checkin };
  }
}
