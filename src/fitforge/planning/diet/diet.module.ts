import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { GeminiModule } from '../../ai/gemini/gemini.module';
import { CheckinsModule } from '../../tracking/checkins/checkins.module';
import { GroceryModule } from '../grocery/grocery.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { DIET_AI_PROVIDER } from './ai/diet-ai.provider';
import { DietAiGateway } from './ai/diet-ai.gateway';
import { DietResponseValidator } from './ai/diet-response.validator';
import { GeminiDietProvider } from './ai/gemini-diet.provider';
import { DietRepository } from './repositories/diet.repository';
import { DietController } from './routes/diet.controller';
import { DietMealNormalizerService } from './services/diet-meal-normalizer.service';
import { DietPlannerService } from './services/diet-planner.service';
import { DietService } from './services/diet.service';

@Module({
  imports: [
    AiGenerationModule,
    GeminiModule,
    MealPlansModule,
    CheckinsModule,
    GroceryModule,
  ],
  controllers: [DietController],
  providers: [
    DietService,
    DietPlannerService,
    DietRepository,
    DietMealNormalizerService,
    DietResponseValidator,
    DietAiGateway,
    GeminiDietProvider,
    {
      provide: DIET_AI_PROVIDER,
      useExisting: GeminiDietProvider,
    },
  ],
  exports: [DietService, DietPlannerService, DietMealNormalizerService],
})
export class DietModule {}
