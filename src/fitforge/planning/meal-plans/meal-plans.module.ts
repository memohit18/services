import { Module } from '@nestjs/common';
import { MealPlansController } from './routes/meal-plans.controller';
import { MealPlansService } from './services/meal-plans.service';

@Module({
  controllers: [MealPlansController],
  providers: [MealPlansService],
  exports: [MealPlansService],
})
export class MealPlansModule {}
