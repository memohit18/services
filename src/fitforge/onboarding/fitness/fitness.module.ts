import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { DietModule } from '../../planning/diet/diet.module';
import { TransformationModule } from '../../planning/transformation/transformation.module';
import { WorkoutsModule } from '../../training/workouts/workouts.module';
import { FitnessProfileModule } from '../fitness-profile/fitness-profile.module';
import { PhysiqueGoalsModule } from '../physique-goals/physique-goals.module';
import { UserOnboardingModule } from '../user-onboarding/user-onboarding.module';
import { FitnessController } from './routes/fitness.controller';
import { FitnessApiService } from './services/fitness-api.service';

@Module({
  imports: [
    FitnessProfileModule,
    PhysiqueGoalsModule,
    UserOnboardingModule,
    TransformationModule,
    DietModule,
    WorkoutsModule,
    AiGenerationModule,
  ],
  controllers: [FitnessController],
  providers: [FitnessApiService],
  exports: [FitnessApiService],
})
export class FitnessModule {}
