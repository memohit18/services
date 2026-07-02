import { Module } from '@nestjs/common';
import { FitnessProfileController } from './routes/fitness-profile.controller';
import { FitnessProfileService } from './services/fitness-profile.service';
import { UserOnboardingModule } from '../user-onboarding/user-onboarding.module';

@Module({
  imports: [UserOnboardingModule],
  controllers: [FitnessProfileController],
  providers: [FitnessProfileService],
  exports: [FitnessProfileService],
})
export class FitnessProfileModule {}
