import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { WorkoutsController } from './routes/workouts.controller';
import { WorkoutsService } from './services/workouts.service';

@Module({
  imports: [AiGenerationModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
