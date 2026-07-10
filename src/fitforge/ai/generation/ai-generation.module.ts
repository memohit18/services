import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { AiGenerationPipeline } from '../pipeline';
import { AiSharedModule } from '../shared/ai-shared.module';
import { AiDietTargetsService } from './ai-diet-targets.service';
import { AiMealPlanService } from './ai-meal-plan.service';
import { AiWorkoutPlanService } from './ai-workout-plan.service';

@Module({
  imports: [AiSharedModule, GeminiModule],
  providers: [
    AiGenerationPipeline,
    AiDietTargetsService,
    AiMealPlanService,
    AiWorkoutPlanService,
  ],
  exports: [AiDietTargetsService, AiMealPlanService, AiWorkoutPlanService],
})
export class AiGenerationModule {}
