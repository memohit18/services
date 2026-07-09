import {
  BUDGET_PREFERENCES,
  COOKING_TIMES,
  FOOD_CATEGORIES,
  FOOD_PREFERENCE_TYPES,
  MEAL_COUNTS,
  PREFERRED_CUISINES,
} from '../../../../../db-schema/postgres/constants/fitforge-values';

export enum FoodPreferenceTypeEnum {
  FAVORITE = 'favorite',
  AVAILABLE = 'available',
  RESTRICTED = 'restricted',
  ALLERGY = 'allergy',
}

export enum BudgetCategoryEnum {
  BUDGET = 'budget',
  MODERATE = 'moderate',
  PREMIUM = 'premium',
}

export enum PreferredCuisineEnum {
  INDIAN = 'indian',
  NORTH_INDIAN = 'north_indian',
  SOUTH_INDIAN = 'south_indian',
  EAST_INDIAN = 'east_indian',
  WEST_INDIAN = 'west_indian',
  CONTINENTAL = 'continental',
  CHINESE_INDIAN = 'chinese_indian',
}

export enum CookingTimeEnum {
  QUICK = 'quick',
  MODERATE = 'moderate',
  ELABORATE = 'elaborate',
}

export const FOOD_PREFERENCE_TYPE_VALUES = FOOD_PREFERENCE_TYPES;
export const FOOD_CATEGORY_VALUES = FOOD_CATEGORIES;
export const BUDGET_CATEGORY_VALUES = BUDGET_PREFERENCES;
export const PREFERRED_CUISINE_VALUES = PREFERRED_CUISINES;
export const MEAL_COUNT_VALUES = MEAL_COUNTS;
export const COOKING_TIME_VALUES = COOKING_TIMES;
