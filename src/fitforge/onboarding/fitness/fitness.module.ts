import { Module } from '@nestjs/common';
import { FitnessProfileModule } from '../fitness-profile/fitness-profile.module';
import { PhysiqueGoalsModule } from '../physique-goals/physique-goals.module';
import { UserOnboardingModule } from '../user-onboarding/user-onboarding.module';
import { FitnessController } from './routes/fitness.controller';
import { FitnessApiService } from './services/fitness-api.service';

@Module({
  imports: [FitnessProfileModule, PhysiqueGoalsModule, UserOnboardingModule],
  controllers: [FitnessController],
  providers: [FitnessApiService],
  exports: [FitnessApiService],
})
export class FitnessModule {}
