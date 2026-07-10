import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { CheckinsModule } from '../../tracking/checkins/checkins.module';
import { MealPlanRepository } from './repositories/meal-plan.repository';
import { MealItemRepository } from './repositories/meal-item.repository';
import { MealLogRepository } from './repositories/meal-log.repository';
import { MealPlansController } from './routes/meal-plans.controller';
import { MealGeneratorService } from './services/meal-generator.service';
import { MealPlanNormalizer } from './services/meal-plan-normalizer.service';
import { MealPlansService } from './services/meal-plans.service';
import { MealTrackingService } from './services/meal-tracking.service';

@Module({
  imports: [AiGenerationModule, CheckinsModule],
  controllers: [MealPlansController],
  providers: [
    MealPlansService,
    MealGeneratorService,
    MealPlanNormalizer,
    MealTrackingService,
    MealPlanRepository,
    MealItemRepository,
    MealLogRepository,
  ],
  exports: [
    MealPlansService,
    MealGeneratorService,
    MealPlanNormalizer,
    MealTrackingService,
  ],
})
export class MealPlansModule {}
