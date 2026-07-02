import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../../ai/generation/ai-generation.module';
import { MealPlansController } from './routes/meal-plans.controller';
import { MealGeneratorService } from './services/meal-generator.service';
import { MealPlansService } from './services/meal-plans.service';

@Module({
  imports: [AiGenerationModule],
  controllers: [MealPlansController],
  providers: [MealPlansService, MealGeneratorService],
  exports: [MealPlansService, MealGeneratorService],
})
export class MealPlansModule {}
