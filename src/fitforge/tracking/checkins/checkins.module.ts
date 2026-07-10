import { Module } from '@nestjs/common';
import { DailyCheckinRepository } from './repositories/daily-checkin.repository';
import { HydrationLogRepository } from './repositories/hydration-log.repository';
import { WorkoutSessionLogRepository } from './repositories/workout-session-log.repository';
import { CheckinsController } from './routes/checkins.controller';
import { CheckinsService } from './services/checkins.service';
import { DailyAggregatorService } from './services/daily-aggregator.service';
import { HydrationService } from './services/hydration.service';
import { WorkoutSessionService } from './services/workout-session.service';

@Module({
  controllers: [CheckinsController],
  providers: [
    CheckinsService,
    DailyAggregatorService,
    HydrationService,
    WorkoutSessionService,
    DailyCheckinRepository,
    HydrationLogRepository,
    WorkoutSessionLogRepository,
  ],
  exports: [
    DailyAggregatorService,
    HydrationService,
    WorkoutSessionService,
    CheckinsService,
  ],
})
export class CheckinsModule {}
