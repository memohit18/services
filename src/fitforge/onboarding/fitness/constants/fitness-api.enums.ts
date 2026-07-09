/** Frontend-facing enum values for /fitness/* APIs */

export const FITNESS_API_GENDERS = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
] as const;

export const FITNESS_API_ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'athlete',
] as const;

export const FITNESS_API_FITNESS_GOALS = [
  'weight_loss',
  'fat_loss',
  'lean_bulk',
  'muscle_gain',
  'body_recomposition',
  'maintain_weight',
] as const;

export const FITNESS_API_DIET_TYPES = [
  'balanced',
  'vegetarian',
  'vegan',
  'keto',
  'paleo',
  'mediterranean',
  'high_protein',
] as const;

export const FITNESS_API_WORKOUT_EXPERIENCE = [
  'beginner',
  'intermediate',
  'advanced',
] as const;
