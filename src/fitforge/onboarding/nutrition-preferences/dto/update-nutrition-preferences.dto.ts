import { PartialType } from '@nestjs/swagger';
import { CreateNutritionPreferencesDto } from './create-nutrition-preferences.dto';

export class UpdateNutritionPreferencesDto extends PartialType(
  CreateNutritionPreferencesDto,
) {}
