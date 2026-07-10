import { Module } from '@nestjs/common';
import { MealPlansModule } from '../../planning/meal-plans/meal-plans.module';
import { MealsController } from './routes/meals.controller';

@Module({
  imports: [MealPlansModule],
  controllers: [MealsController],
})
export class MealsExecutionModule {}
