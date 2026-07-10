export type NutritionPlanSummary = {
  dailyTarget: string;
  proteinGoal: string;
  calories: number;
  protein: number;
  ready: boolean;
};

export type WorkoutPlanSummary = {
  frequency: string;
  focusArea: string;
  daysPerWeek: number;
  fitnessGoal: string;
  ready: boolean;
};

export type PlansSummary = {
  nutrition: NutritionPlanSummary;
  workout: WorkoutPlanSummary;
  ready: boolean;
  transformationId: string | null;
  dietPlanId: string | null;
  workoutPlanId: string | null;
};
