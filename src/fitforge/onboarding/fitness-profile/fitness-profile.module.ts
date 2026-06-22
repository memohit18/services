import { Module } from '@nestjs/common';
import { FitnessProfileController } from './routes/fitness-profile.controller';
import { FitnessProfileService } from './services/fitness-profile.service';

@Module({
  controllers: [FitnessProfileController],
  providers: [FitnessProfileService],
  exports: [FitnessProfileService],
})
export class FitnessProfileModule {}
