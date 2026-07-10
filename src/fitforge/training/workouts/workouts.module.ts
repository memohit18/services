import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { CheckinsModule } from '../../tracking/checkins/checkins.module';
import { WorkoutExecutionController } from './routes/workout-execution.controller';
import { WorkoutsController } from './routes/workouts.controller';
import { WorkoutExecutionService } from './services/workout-execution.service';
import { WorkoutsService } from './services/workouts.service';

@Module({
  imports: [AiGenerationModule, CheckinsModule],
  controllers: [WorkoutsController, WorkoutExecutionController],
  providers: [WorkoutsService, WorkoutExecutionService],
  exports: [WorkoutsService, WorkoutExecutionService],
})
export class WorkoutsModule {}
