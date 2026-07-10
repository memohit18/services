import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WORKOUT_SESSION_STATUSES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../../prisma/prisma.service';
import { startOfLocalCalendarDay } from '../aggregator/daily-aggregator.engine';
import { CreateWorkoutSessionDto } from '../dto/create-workout-session.dto';
import { WorkoutSessionLogRepository } from '../repositories/workout-session-log.repository';
import { DailyAggregatorService } from './daily-aggregator.service';

@Injectable()
export class WorkoutSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionLogRepository: WorkoutSessionLogRepository,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  async log(userId: string, dto: CreateWorkoutSessionDto) {
    if (
      !WORKOUT_SESSION_STATUSES.includes(
        dto.status as (typeof WORKOUT_SESSION_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        `status must be one of: ${WORKOUT_SESSION_STATUSES.join(', ')}`,
      );
    }

    if (dto.workoutPlanDayId) {
      const day = await this.prisma.workoutDay.findUnique({
        where: { id: dto.workoutPlanDayId },
        include: { workoutPlan: { select: { userId: true } } },
      });
      if (!day || day.workoutPlan.userId !== userId) {
        throw new NotFoundException('Workout plan day not found');
      }
    }

    const completedAt =
      dto.status === 'skipped' ? null : (dto.completedAt ? new Date(dto.completedAt) : new Date());

    const session = await this.sessionLogRepository.create({
      user: { connect: { id: userId } },
      ...(dto.workoutPlanDayId
        ? { workoutPlanDay: { connect: { id: dto.workoutPlanDayId } } }
        : {}),
      durationMinutes: dto.durationMinutes,
      caloriesBurned: dto.caloriesBurned,
      status: dto.status,
      completedAt,
    });

    const day = startOfLocalCalendarDay(completedAt ?? new Date());
    const checkin = await this.dailyAggregator.rebuildForDate(userId, day);

    return { session, checkin };
  }

  async listToday(userId: string) {
    const start = startOfLocalCalendarDay();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return this.sessionLogRepository.findForDay(userId, start, end);
  }
}
