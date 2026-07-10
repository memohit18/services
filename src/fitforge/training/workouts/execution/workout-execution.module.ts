import { Module } from '@nestjs/common';
import { WorkoutLogRepository } from './repositories/workout-log.repository';
import { WorkoutExecutionEngineController } from './routes/workout-execution-engine.controller';
import { WorkoutExecutionEngineService } from './services/workout-execution-engine.service';
import { WorkoutSessionModule } from './workout-session.module';

@Module({
  imports: [WorkoutSessionModule],
  controllers: [WorkoutExecutionEngineController],
  providers: [WorkoutExecutionEngineService, WorkoutLogRepository],
  exports: [WorkoutExecutionEngineService, WorkoutLogRepository],
})
export class WorkoutExecutionModule {}
