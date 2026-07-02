import { Module } from '@nestjs/common';
import { AiSharedModule } from '../shared/ai-shared.module';
import { AiDietTargetsService } from './ai-diet-targets.service';
import { AiMealPlanService } from './ai-meal-plan.service';
import { AiWorkoutPlanService } from './ai-workout-plan.service';

@Module({
  imports: [AiSharedModule],
  providers: [AiDietTargetsService, AiMealPlanService, AiWorkoutPlanService],
  exports: [AiDietTargetsService, AiMealPlanService, AiWorkoutPlanService],
})
export class AiGenerationModule {}
