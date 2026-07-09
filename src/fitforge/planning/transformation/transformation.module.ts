import { Module } from '@nestjs/common';
import { FitnessProfileModule } from '../../onboarding/fitness-profile/fitness-profile.module';
import { TransformationController } from './routes/transformation.controller';
import { TransformationRepository } from './repositories/transformation.repository';
import { TransformationService } from './services/transformation.service';

@Module({
  imports: [FitnessProfileModule],
  controllers: [TransformationController],
  providers: [TransformationRepository, TransformationService],
  exports: [TransformationService],
})
export class TransformationModule {}
