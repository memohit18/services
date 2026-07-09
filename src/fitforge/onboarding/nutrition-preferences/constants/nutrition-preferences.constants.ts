import {
  BUDGET_PREFERENCES,
  MEALS_PER_DAY_VALUES,
  PREFERRED_CUISINES,
  PREFERRED_MEAL_TIMINGS,
} from '../../../../../db-schema/postgres/constants/fitforge-values';

export enum BudgetCategoryEnum {
  BUDGET = 'budget',
  MODERATE = 'moderate',
  PREMIUM = 'premium',
}

export enum PreferredCuisineEnum {
  INDIAN = 'indian',
  NORTH_INDIAN = 'north_indian',
  SOUTH_INDIAN = 'south_indian',
  MIXED = 'mixed',
  INTERNATIONAL = 'international',
}

export enum PreferredMealTimingEnum {
  EARLY = 'early',
  FLEXIBLE = 'flexible',
  LATE = 'late',
}

export const BUDGET_CATEGORY_VALUES = BUDGET_PREFERENCES;
export const PREFERRED_CUISINE_VALUES = PREFERRED_CUISINES;
export const MEALS_PER_DAY_ALLOWED = MEALS_PER_DAY_VALUES;
export const PREFERRED_MEAL_TIMING_VALUES = PREFERRED_MEAL_TIMINGS;
export const COOKING_TIME_MIN = 15;
export const COOKING_TIME_MAX = 120;
