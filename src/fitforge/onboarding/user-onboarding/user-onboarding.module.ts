import { Module } from '@nestjs/common';
import { UserOnboardingController } from './routes/user-onboarding.controller';
import { UserOnboardingService } from './services/user-onboarding.service';

@Module({
  controllers: [UserOnboardingController],
  providers: [UserOnboardingService],
  exports: [UserOnboardingService],
})
export class UserOnboardingModule {}
