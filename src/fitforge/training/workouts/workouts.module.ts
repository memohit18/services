import { Module } from '@nestjs/common';
import { WorkoutsController } from './routes/workouts.controller';
import { WorkoutsService } from './services/workouts.service';

@Module({
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
