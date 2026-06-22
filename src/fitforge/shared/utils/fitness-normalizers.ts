import {
  ACTIVITY_LEVELS,
  DIET_TYPES,
  type ActivityLevel,
  type DietType,
} from '../../../../db-schema/postgres/constants/fitforge-values';

const ACTIVITY_ALIASES: Record<string, ActivityLevel> = {
  low: 'lightly_active',
  moderate: 'moderately_active',
  moderately: 'moderately_active',
  high: 'very_active',
  sedentary: 'sedentary',
  lightly_active: 'lightly_active',
  moderately_active: 'moderately_active',
  very_active: 'very_active',
  extra_active: 'extra_active',
};

const DIET_ALIASES: Record<string, DietType> = {
  veg: 'vegetarian',
  vegetarian: 'vegetarian',
  non_veg: 'non_vegetarian',
  non_vegetarian: 'non_vegetarian',
  eggetarian: 'eggetarian',
  vegan: 'vegan',
};

export function normalizeActivityLevel(value: string): ActivityLevel {
  const normalized = ACTIVITY_ALIASES[value];
  if (normalized) {
    return normalized;
  }
  if ((ACTIVITY_LEVELS as readonly string[]).includes(value)) {
    return value as ActivityLevel;
  }
  return 'moderately_active';
}

export function normalizeDietType(value: string): DietType {
  const normalized = DIET_ALIASES[value];
  if (normalized) {
    return normalized;
  }
  if ((DIET_TYPES as readonly string[]).includes(value)) {
    return value as DietType;
  }
  return value as DietType;
}
