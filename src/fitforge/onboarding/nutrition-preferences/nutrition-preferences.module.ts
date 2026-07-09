import { Module } from '@nestjs/common';
import { NutritionPreferencesController } from './controllers/nutrition-preferences.controller';
import { NutritionPreferencesRepository } from './repositories/nutrition-preferences.repository';
import { NutritionPreferencesService } from './services/nutrition-preferences.service';

@Module({
  controllers: [NutritionPreferencesController],
  providers: [NutritionPreferencesRepository, NutritionPreferencesService],
  exports: [NutritionPreferencesService],
})
export class NutritionPreferencesModule {}
