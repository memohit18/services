import { BadRequestException } from '@nestjs/common';
import {
  FOOD_CATEGORIES,
  type FoodCategory,
} from '../../../../../db-schema/postgres/constants/fitforge-values';

const CATEGORY_ALIASES: Record<string, FoodCategory> = {
  carb: 'grain',
  carbs: 'grain',
  carbohydrate: 'grain',
  carbohydrates: 'grain',
  grain: 'grain',
  grains: 'grain',
  staple: 'staple',
  staples: 'staple',
  protein: 'protein',
  proteins: 'protein',
  vegetable: 'vegetable',
  vegetables: 'vegetable',
  veggie: 'vegetable',
  veggies: 'vegetable',
  fruit: 'fruit',
  fruits: 'fruit',
  dairy: 'dairy',
  dairies: 'dairy',
  legume: 'legume',
  legumes: 'legume',
  snack: 'snack',
  snacks: 'snack',
  beverage: 'beverage',
  beverages: 'beverage',
  drink: 'beverage',
  drinks: 'beverage',
  dessert: 'dessert',
  desserts: 'dessert',
  sweet: 'dessert',
  sweets: 'dessert',
  fat: 'fat',
  fats: 'fat',
  breakfast: 'breakfast',
};

export function normalizeFoodCategory(value: string): FoodCategory {
  const key = value.trim().toLowerCase();
  const aliased = CATEGORY_ALIASES[key];
  if (aliased) {
    return aliased;
  }
  if ((FOOD_CATEGORIES as readonly string[]).includes(key)) {
    return key as FoodCategory;
  }
  throw new BadRequestException(
    `Invalid category "${value}". Allowed values: ${FOOD_CATEGORIES.join(', ')}. ` +
      `Common aliases: carbs→grain, vegetables→vegetable, fruits→fruit, proteins→protein.`,
  );
}

export function transformFoodCategoryInput(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' && value.length > 0) {
    return normalizeFoodCategory(value);
  }
  return undefined;
}

export function transformFoodCategoryUpdate(
  value: unknown,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return normalizeFoodCategory(value);
  }
  return undefined;
}

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  breakfast: 'Breakfast',
  staple: 'Staple',
  protein: 'Protein',
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  dairy: 'Dairy',
  legume: 'Legume',
  grain: 'Grain',
  snack: 'Snack',
  beverage: 'Beverage',
  dessert: 'Dessert',
  fat: 'Fat',
};
