import { Module } from '@nestjs/common';
import { FoodPreferencesController } from './routes/food-preferences.controller';
import { FoodPreferencesService } from './services/food-preferences.service';

@Module({
  controllers: [FoodPreferencesController],
  providers: [FoodPreferencesService],
})
export class FoodPreferencesModule {}
