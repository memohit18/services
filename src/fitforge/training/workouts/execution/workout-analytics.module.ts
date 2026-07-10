import { Module } from '@nestjs/common';
import { WorkoutSessionModule } from './workout-session.module';

/** Re-exports analytics for AI / progress consumers. */
@Module({
  imports: [WorkoutSessionModule],
  exports: [WorkoutSessionModule],
})
export class WorkoutAnalyticsModule {}
