import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { DietController } from './routes/diet.controller';
import { DietPlannerService } from './services/diet-planner.service';
import { DietService } from './services/diet.service';

@Module({
  imports: [AiGenerationModule, MealPlansModule],
  controllers: [DietController],
  providers: [DietService, DietPlannerService],
  exports: [DietService, DietPlannerService],
})
export class DietModule {}
