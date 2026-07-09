import type { PhysiqueGoal, UserFitnessProfile } from '@prisma/client';
import type { CreateFitnessProfileDto } from '../../fitness-profile/dto/create-fitness-profile.dto';
import type { UpdateFitnessProfileDto } from '../../fitness-profile/dto/update-fitness-profile.dto';

const GOALS_IMAGE_BASE =
  process.env.FITNESS_GOALS_IMAGE_BASE ?? 'https://cdn.fitforge.app/goals';

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export type FitnessGoalApi = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

export type FitnessProfileApi = {
  id: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  fitnessGoal: string;
  physiqueGoalId: string;
  dietType: string;
  workoutExperience: string;
  workoutDaysPerWeek: number;
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  allergies: string | null;
  onboardingCompleted: boolean;
  physiqueGoal: FitnessGoalApi | null;
  createdAt: string;
  updatedAt: string;
};

export type FitnessProfileApiInput = {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  fitnessGoal: string;
  physiqueGoalId: string;
  dietType: string;
  workoutExperience: string;
  workoutDaysPerWeek: number;
  targetWeightKg?: number | null;
  targetBodyFatPercent?: number | null;
  allergies?: string | null;
  onboardingCompleted?: boolean;
};

const ACTIVITY_TO_INTERNAL: Record<string, string> = {
  sedentary: 'sedentary',
  light: 'lightly_active',
  moderate: 'moderately_active',
  active: 'very_active',
  athlete: 'extra_active',
};

const ACTIVITY_TO_API: Record<string, string> = {
  sedentary: 'sedentary',
  lightly_active: 'light',
  moderately_active: 'moderate',
  very_active: 'active',
  extra_active: 'athlete',
};

const FITNESS_GOAL_TO_INTERNAL: Record<string, string> = {
  weight_loss: 'fat_loss',
  fat_loss: 'fat_loss',
  lean_bulk: 'muscle_gain',
  muscle_gain: 'muscle_gain',
  body_recomposition: 'recomposition',
  maintain_weight: 'maintenance',
};

const FITNESS_GOAL_TO_API: Record<string, string> = {
  fat_loss: 'fat_loss',
  muscle_gain: 'lean_bulk',
  recomposition: 'body_recomposition',
  maintenance: 'maintain_weight',
};

const DIET_TO_INTERNAL: Record<string, string> = {
  balanced: 'vegetarian',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  keto: 'non_vegetarian',
  paleo: 'non_vegetarian',
  mediterranean: 'vegetarian',
  high_protein: 'non_vegetarian',
};

const DIET_TO_API: Record<string, string> = {
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  eggetarian: 'balanced',
  non_vegetarian: 'high_protein',
};

export function toGoalSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function toFitnessGoalApi(goal: PhysiqueGoal): FitnessGoalApi {
  const slug = toGoalSlug(goal.name);
  return {
    id: slug,
    title: goal.name,
    description: goal.description ?? '',
    imageUrl: goal.imageUrl ?? `${GOALS_IMAGE_BASE}/${slug}.jpg`,
  };
}

export function toFitnessProfileApi(
  profile: UserFitnessProfile,
  onboardingCompleted: boolean,
  physiqueGoal: PhysiqueGoal | null,
): FitnessProfileApi {
  const goalApi = physiqueGoal ? toFitnessGoalApi(physiqueGoal) : null;
  return {
    id: profile.id,
    age: profile.age,
    gender:
      profile.gender === 'other' ? 'prefer_not_to_say' : profile.gender,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel:
      ACTIVITY_TO_API[profile.activityLevel] ?? profile.activityLevel,
    fitnessGoal:
      FITNESS_GOAL_TO_API[profile.fitnessGoal] ?? profile.fitnessGoal,
    physiqueGoalId: goalApi?.id ?? profile.physiqueGoalId,
    dietType: DIET_TO_API[profile.dietType] ?? profile.dietType,
    workoutExperience: profile.experienceLevel ?? 'beginner',
    workoutDaysPerWeek: profile.workoutDaysPerWeek ?? 3,
    targetWeightKg: profile.targetWeightKg,
    targetBodyFatPercent: profile.targetBodyFat,
    allergies: profile.allergies,
    onboardingCompleted,
    physiqueGoal: goalApi,
    createdAt: toIsoString(profile.createdAt),
    updatedAt: toIsoString(profile.updatedAt),
  };
}

export function toInternalCreateDto(
  input: FitnessProfileApiInput,
): CreateFitnessProfileDto {
  return {
    age: input.age,
    gender: input.gender === 'prefer_not_to_say' ? 'other' : input.gender,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel:
      ACTIVITY_TO_INTERNAL[input.activityLevel] ?? input.activityLevel,
    fitnessGoal:
      FITNESS_GOAL_TO_INTERNAL[input.fitnessGoal] ?? input.fitnessGoal,
    physiqueGoalId: input.physiqueGoalId,
    dietType: DIET_TO_INTERNAL[input.dietType] ?? input.dietType,
    experienceLevel: input.workoutExperience,
    workoutDaysPerWeek: input.workoutDaysPerWeek,
    targetWeightKg: input.targetWeightKg ?? undefined,
    targetBodyFat: input.targetBodyFatPercent ?? undefined,
    allergies: input.allergies ?? undefined,
  };
}

export function toInternalUpdateDto(
  input: Partial<FitnessProfileApiInput>,
): UpdateFitnessProfileDto {
  const dto: UpdateFitnessProfileDto = {};
  if (input.age != null) dto.age = input.age;
  if (input.gender != null) {
    dto.gender = input.gender === 'prefer_not_to_say' ? 'other' : input.gender;
  }
  if (input.heightCm != null) dto.heightCm = input.heightCm;
  if (input.weightKg != null) dto.weightKg = input.weightKg;
  if (input.activityLevel != null) {
    dto.activityLevel =
      ACTIVITY_TO_INTERNAL[input.activityLevel] ?? input.activityLevel;
  }
  if (input.fitnessGoal != null) {
    dto.fitnessGoal =
      FITNESS_GOAL_TO_INTERNAL[input.fitnessGoal] ?? input.fitnessGoal;
  }
  if (input.physiqueGoalId != null) dto.physiqueGoalId = input.physiqueGoalId;
  if (input.dietType != null) {
    dto.dietType = DIET_TO_INTERNAL[input.dietType] ?? input.dietType;
  }
  if (input.workoutExperience != null) {
    dto.experienceLevel = input.workoutExperience;
  }
  if (input.workoutDaysPerWeek != null) {
    dto.workoutDaysPerWeek = input.workoutDaysPerWeek;
  }
  if (input.targetWeightKg !== undefined) {
    dto.targetWeightKg = input.targetWeightKg ?? undefined;
  }
  if (input.targetBodyFatPercent !== undefined) {
    dto.targetBodyFat = input.targetBodyFatPercent ?? undefined;
  }
  if (input.allergies !== undefined) {
    dto.allergies = input.allergies ?? undefined;
  }
  return dto;
}
