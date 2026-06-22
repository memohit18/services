import { Module } from '@nestjs/common';
import { FitnessProfileModule } from '../../onboarding/fitness-profile/fitness-profile.module';
import { ProgressController } from './routes/progress.controller';
import { ProgressService } from './services/progress.service';

@Module({
  imports: [FitnessProfileModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
