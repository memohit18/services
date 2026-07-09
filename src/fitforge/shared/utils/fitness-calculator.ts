import { normalizeActivityLevel } from './fitness-normalizers';

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export type FitnessMetricsInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: string;
  activityLevel: string;
  fitnessGoal?: string;
  targetWeightKg?: number;
};

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return round1((weightKg / (heightM * heightM)));
}

export function calculateBMR(input: Pick<FitnessMetricsInput, 'weightKg' | 'heightCm' | 'age' | 'gender'>): number {
  const { weightKg, heightCm, age, gender } = input;
  if (gender === 'female') {
    return round0(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return round0(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const level = normalizeActivityLevel(activityLevel);
  const multiplier = ACTIVITY_MULTIPLIERS[level] ?? 1.55;
  return round0(bmr * multiplier);
}

export function calculateProteinTarget(
  targetWeightKg: number,
  fitnessGoal?: string,
): number {
  const goal = normalizeGoal(fitnessGoal);
  const multiplier =
    goal === 'fat_loss' || goal === 'weight_loss'
      ? 2.2
      : goal === 'muscle_gain' || goal === 'lean_bulk'
        ? 2.0
        : 1.6;
  return round0(targetWeightKg * multiplier);
}

export function calculateTargetCalories(
  tdee: number,
  fitnessGoal?: string,
): number {
  const goal = normalizeGoal(fitnessGoal);
  switch (goal) {
    case 'fat_loss':
    case 'weight_loss':
      return round0(tdee - 500);
    case 'lean_bulk':
      return round0(tdee + 250);
    case 'muscle_gain':
      return round0(tdee + 350);
    case 'maintenance':
    case 'maintain_weight':
      return round0(tdee);
    case 'recomposition':
    case 'body_recomposition':
      return round0(tdee - 200);
    default:
      return round0(tdee);
  }
}

export function calculateEstimatedWeeks(
  currentWeightKg: number,
  targetWeightKg: number,
  fitnessGoal?: string,
): number {
  const diff = Math.abs(currentWeightKg - targetWeightKg);
  if (diff === 0) {
    return 0;
  }
  const goal = normalizeGoal(fitnessGoal);
  const weeklyRate =
    goal === 'muscle_gain' || goal === 'lean_bulk'
      ? 0.25
      : 0.5;
  return Math.max(1, Math.ceil(diff / weeklyRate));
}

export function calculateBodyFatChangeRate(
  currentBodyFat?: number | null,
  targetBodyFat?: number | null,
): number | null {
  if (currentBodyFat == null || targetBodyFat == null) {
    return null;
  }
  return round1((currentBodyFat - targetBodyFat) / 4);
}

export function calculateFitnessMetrics(input: FitnessMetricsInput) {
  const bmr = calculateBMR(input);
  const bmi = calculateBMI(input.weightKg, input.heightCm);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  const proteinWeight = input.targetWeightKg ?? input.weightKg;
  const proteinTarget = calculateProteinTarget(proteinWeight, input.fitnessGoal);
  const dailyCalorieTarget = calculateTargetCalories(tdee, input.fitnessGoal);

  return { bmi, bmr, tdee, proteinTarget, dailyCalorieTarget };
}

function normalizeGoal(fitnessGoal?: string): string {
  if (!fitnessGoal) {
    return 'maintenance';
  }
  return fitnessGoal;
}

function round0(value: number): number {
  return Math.round(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
