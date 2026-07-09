import { Module } from '@nestjs/common';
import { FoodsModule } from '../foods/foods.module';
import { FoodPreferencesController } from './routes/food-preferences.controller';
import { FoodPreferencesRepository } from './repositories/food-preferences.repository';
import { NutritionPreferencesRepository } from './repositories/nutrition-preferences.repository';
import { FoodPreferencesService } from './services/food-preferences.service';

@Module({
  imports: [FoodsModule],
  controllers: [FoodPreferencesController],
  providers: [
    FoodPreferencesService,
    FoodPreferencesRepository,
    NutritionPreferencesRepository,
  ],
  exports: [FoodPreferencesService],
})
export class FoodPreferencesModule {}
