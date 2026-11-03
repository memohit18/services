import { Module } from '@nestjs/common';
import { MongoDBModule } from '../../../mongodb/mongodb.module';
import { FitnessProfileController } from './routes/fitness-profile.controller';
import { FitnessProfileService } from './services/fitness-profile.service';
import { UserOnboardingModule } from '../user-onboarding/user-onboarding.module';

@Module({
  imports: [UserOnboardingModule, MongoDBModule],
  controllers: [FitnessProfileController],
  providers: [FitnessProfileService],
  exports: [FitnessProfileService],
})
export class FitnessProfileModule {}
