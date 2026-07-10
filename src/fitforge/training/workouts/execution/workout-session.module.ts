import { Module } from '@nestjs/common';
import { CheckinsModule } from '../../../tracking/checkins/checkins.module';
import { WorkoutSessionRepository } from './repositories/workout-session.repository';
import { WorkoutSessionController } from './routes/workout-session.controller';
import { WorkoutAnalyticsService } from './services/workout-analytics.service';
import { WorkoutSessionService } from './services/workout-session.service';

@Module({
  imports: [CheckinsModule],
  controllers: [WorkoutSessionController],
  providers: [
    WorkoutSessionService,
    WorkoutSessionRepository,
    WorkoutAnalyticsService,
  ],
  exports: [
    WorkoutSessionService,
    WorkoutSessionRepository,
    WorkoutAnalyticsService,
  ],
})
export class WorkoutSessionModule {}
