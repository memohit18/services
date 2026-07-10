export type SetLogLite = {
  setNumber: number | null;
  completedReps: string | null;
  completedWeight: number | null;
  restSeconds: number | null;
  status: string;
  durationMinutes: number | null;
};

export type ExercisePlanLite = {
  id: string;
  sets: number;
  restSeconds: number;
};

export type WorkoutSessionAnalytics = {
  workoutVolume: number;
  workoutDurationMinutes: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  exercisesTotal: number;
  setsCompleted: number;
  setsPlanned: number;
  caloriesBurned: number | null;
  skippedExercises: number;
  completionPercent: number;
};

/**
 * Pure analytics for a workout session (unit-test friendly).
 * Volume ≈ sum(reps * weight) across set logs.
 */
export function computeWorkoutSessionAnalytics(input: {
  plannedExercises: ExercisePlanLite[];
  logs: SetLogLite[];
  durationMinutes: number | null;
  caloriesBurned: number | null;
  /** exercise ids marked completed (summary logs) */
  completedExerciseIds: string[];
  skippedExerciseIds: string[];
}): WorkoutSessionAnalytics {
  const {
    plannedExercises,
    logs,
    durationMinutes,
    caloriesBurned,
    completedExerciseIds,
    skippedExerciseIds,
  } = input;

  const setLogs = logs.filter((l) => l.setNumber != null);
  let workoutVolume = 0;
  for (const log of setLogs) {
    const reps = parseReps(log.completedReps);
    const weight = log.completedWeight ?? 0;
    workoutVolume += reps * weight;
  }
  workoutVolume = Math.round(workoutVolume * 10) / 10;

  const setsCompleted = setLogs.filter(
    (l) => l.status === 'completed' || l.status === 'partial',
  ).length;
  const setsPlanned = plannedExercises.reduce((sum, e) => sum + e.sets, 0);

  const exercisesTotal = plannedExercises.length;
  const exercisesCompleted = completedExerciseIds.length;
  const exercisesSkipped = skippedExerciseIds.length;
  const resolved = exercisesCompleted + exercisesSkipped;
  const completionPercent =
    exercisesTotal === 0
      ? 0
      : Math.round((resolved / exercisesTotal) * 100);

  return {
    workoutVolume,
    workoutDurationMinutes: durationMinutes ?? 0,
    exercisesCompleted,
    exercisesSkipped,
    exercisesTotal,
    setsCompleted,
    setsPlanned,
    caloriesBurned,
    skippedExercises: exercisesSkipped,
    completionPercent,
  };
}

function parseReps(value: string | null): number {
  if (!value) {
    return 0;
  }
  const match = value.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

export function effectiveDurationMinutes(
  createdAt: Date,
  completedAt: Date | null,
  totalPausedSeconds: number,
  now = new Date(),
): number {
  const end = completedAt ?? now;
  const elapsedMs = Math.max(0, end.getTime() - createdAt.getTime());
  const activeMs = Math.max(0, elapsedMs - totalPausedSeconds * 1000);
  return Math.max(0, Math.round(activeMs / 60_000));
}
