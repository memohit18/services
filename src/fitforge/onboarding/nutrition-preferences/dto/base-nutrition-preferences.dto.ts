import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import {
  BUDGET_CATEGORY_VALUES,
  BudgetCategoryEnum,
  MEALS_PER_DAY_ALLOWED,
  PREFERRED_CUISINE_VALUES,
  PREFERRED_MEAL_TIMING_VALUES,
  PreferredCuisineEnum,
  PreferredMealTimingEnum,
} from '../constants/nutrition-preferences.constants';
import { MaxCookingTime, MinCookingTime } from '../validators/cooking-time-range.validator';

export class BaseNutritionPreferencesDto {
  @ApiPropertyOptional({ enum: BudgetCategoryEnum, example: BudgetCategoryEnum.MODERATE })
  @IsOptional()
  @IsIn(BUDGET_CATEGORY_VALUES)
  budgetCategory?: string;

  @ApiPropertyOptional({ enum: PreferredCuisineEnum, example: PreferredCuisineEnum.INDIAN })
  @IsOptional()
  @IsIn(PREFERRED_CUISINE_VALUES)
  preferredCuisine?: string;

  @ApiPropertyOptional({ enum: MEALS_PER_DAY_ALLOWED, example: 4 })
  @IsOptional()
  @IsInt()
  @IsIn(MEALS_PER_DAY_ALLOWED)
  mealsPerDay?: number;

  @ApiPropertyOptional({ minimum: 15, maximum: 120, example: 30 })
  @IsOptional()
  @IsInt()
  @MinCookingTime()
  @MaxCookingTime()
  cookingTimeMinutes?: number;

  @ApiPropertyOptional({
    enum: PreferredMealTimingEnum,
    example: PreferredMealTimingEnum.FLEXIBLE,
  })
  @IsOptional()
  @IsIn(PREFERRED_MEAL_TIMING_VALUES)
  preferredMealTiming?: string;
}
