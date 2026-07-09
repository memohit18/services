import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';
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

export class CreateNutritionPreferencesDto {
  @ApiProperty({ enum: BudgetCategoryEnum, example: BudgetCategoryEnum.MODERATE })
  @IsNotEmpty()
  @IsIn(BUDGET_CATEGORY_VALUES)
  budgetCategory: string;

  @ApiProperty({ enum: PreferredCuisineEnum, example: PreferredCuisineEnum.INDIAN })
  @IsNotEmpty()
  @IsIn(PREFERRED_CUISINE_VALUES)
  preferredCuisine: string;

  @ApiProperty({ enum: MEALS_PER_DAY_ALLOWED, example: 4 })
  @IsInt()
  @IsIn(MEALS_PER_DAY_ALLOWED)
  mealsPerDay: number;

  @ApiProperty({ minimum: 15, maximum: 120, example: 30 })
  @IsInt()
  @MinCookingTime()
  @MaxCookingTime()
  cookingTimeMinutes: number;

  @ApiProperty({ enum: PreferredMealTimingEnum, example: PreferredMealTimingEnum.FLEXIBLE })
  @IsNotEmpty()
  @IsIn(PREFERRED_MEAL_TIMING_VALUES)
  preferredMealTiming: string;
}
