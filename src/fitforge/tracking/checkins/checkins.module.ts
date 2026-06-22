import { Module } from '@nestjs/common';
import { DietModule } from '../../planning/diet/diet.module';
import { WorkoutsModule } from '../../training/workouts/workouts.module';
import { CheckinsController } from './routes/checkins.controller';
import { CheckinsService } from './services/checkins.service';

@Module({
  imports: [DietModule, WorkoutsModule],
  controllers: [CheckinsController],
  providers: [CheckinsService],
})
export class CheckinsModule {}
