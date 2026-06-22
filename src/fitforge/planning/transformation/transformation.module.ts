import { Module } from '@nestjs/common';
import { FitnessProfileModule } from '../../onboarding/fitness-profile/fitness-profile.module';
import { TransformationController } from './routes/transformation.controller';
import { TransformationService } from './services/transformation.service';

@Module({
  imports: [FitnessProfileModule],
  controllers: [TransformationController],
  providers: [TransformationService],
})
export class TransformationModule {}
