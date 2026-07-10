import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { WorkoutAnalyticsModule } from './execution/workout-analytics.module';
import { WorkoutExecutionModule } from './execution/workout-execution.module';
import { WorkoutSessionModule } from './execution/workout-session.module';
import { WorkoutsController } from './routes/workouts.controller';
import { WorkoutsService } from './services/workouts.service';

@Module({
  imports: [
    AiGenerationModule,
    WorkoutSessionModule,
    WorkoutExecutionModule,
    WorkoutAnalyticsModule,
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [
    WorkoutsService,
    AiGenerationModule,
    WorkoutSessionModule,
    WorkoutExecutionModule,
    WorkoutAnalyticsModule,
  ],
})
export class WorkoutsModule {}
