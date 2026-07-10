import { Module } from '@nestjs/common';
import { CheckinsModule } from '../../tracking/checkins/checkins.module';
import { HydrationController } from './routes/hydration.controller';

@Module({
  imports: [CheckinsModule],
  controllers: [HydrationController],
})
export class HydrationExecutionModule {}
