import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';
import {
  BudgetCategoryEnum,
  CookingTimeEnum,
  MEAL_COUNT_VALUES,
  PreferredCuisineEnum,
} from '../constants/food-preferences.enums';

export class NutritionPreferenceDto {
  @ApiPropertyOptional({ enum: BudgetCategoryEnum, example: BudgetCategoryEnum.MODERATE })
  @IsOptional()
  @IsEnum(BudgetCategoryEnum)
  budgetCategory?: BudgetCategoryEnum;

  @ApiPropertyOptional({
    enum: PreferredCuisineEnum,
    example: PreferredCuisineEnum.INDIAN,
  })
  @IsOptional()
  @IsEnum(PreferredCuisineEnum)
  preferredCuisine?: PreferredCuisineEnum;

  @ApiPropertyOptional({ enum: MEAL_COUNT_VALUES, example: 4 })
  @IsOptional()
  @IsInt()
  @IsIn(MEAL_COUNT_VALUES)
  mealCount?: number;

  @ApiPropertyOptional({ enum: CookingTimeEnum, example: CookingTimeEnum.MODERATE })
  @IsOptional()
  @IsEnum(CookingTimeEnum)
  cookingTime?: CookingTimeEnum;
}
