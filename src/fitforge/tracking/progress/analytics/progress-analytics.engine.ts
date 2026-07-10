import type { ProgressLog, TransformationTarget, UserFitnessProfile } from '@prisma/client';

export type ProgressTrendPoint = {
  date: string;
  value: number;
};

export type ProgressAnalyticsResult = {
  weightTrend: ProgressTrendPoint[];
  bodyFatTrend: ProgressTrendPoint[];
  measurementTrends: {
    waist: ProgressTrendPoint[];
    chest: ProgressTrendPoint[];
    arm: ProgressTrendPoint[];
    thigh: ProgressTrendPoint[];
  };
  weightDifference: number;
  bodyFatDifference: number;
  averageWeeklyWeightChange: number;
  averageMeasurementChange: {
    waist: number;
    chest: number;
    arm: number;
    thigh: number;
  };
  goalCompletionPercent: number;
  transformationPercent: number;
  estimatedCompletionDate: string | null;
  consistencyScore: number;
  currentStreak: number;
  compliancePercent: number;
  etaWeeks: number | null;
  sampleSize: number;
};

type CheckinLite = {
  checkInDate: Date;
  workoutCompleted: boolean;
  mealsCompleted: number;
  mealsSkipped: number;
};

type MealLogLite = {
  status: string;
  consumedAt: Date | null;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function series(
  logs: ProgressLog[],
  pick: (log: ProgressLog) => number | null | undefined,
): ProgressTrendPoint[] {
  return logs
    .filter((log) => pick(log) != null)
    .map((log) => ({
      date: toDateKey(log.createdAt),
      value: pick(log) as number,
    }));
}

function firstLastDiff(points: ProgressTrendPoint[]): number {
  if (points.length < 2) {
    return 0;
  }
  return round1(points[points.length - 1].value - points[0].value);
}

function weeksBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(ms / (7 * 86_400_000), 1 / 7);
}

/**
 * Pure analytics engine — no DB / Nest deps (unit-test friendly).
 */
export function computeProgressAnalytics(input: {
  logs: ProgressLog[];
  transformation: TransformationTarget | null;
  profile: UserFitnessProfile | null;
  mealLogs: MealLogLite[];
  checkins: CheckinLite[];
}): ProgressAnalyticsResult {
  const { logs, transformation, profile, mealLogs, checkins } = input;

  const weightTrend = series(logs, (l) => l.weightKg);
  const bodyFatTrend = series(logs, (l) => l.bodyFatPercentage);
  const waist = series(logs, (l) => l.waistCm);
  const chest = series(logs, (l) => l.chestCm);
  const arm = series(logs, (l) => l.armCm);
  const thigh = series(logs, (l) => l.thighCm);

  const weightDifference = firstLastDiff(weightTrend);
  const bodyFatDifference = firstLastDiff(bodyFatTrend);

  let averageWeeklyWeightChange = 0;
  if (weightTrend.length >= 2) {
    const first = logs.find((l) => l.weightKg != null)!;
    const last = [...logs].reverse().find((l) => l.weightKg != null)!;
    averageWeeklyWeightChange = round1(
      weightDifference / weeksBetween(first.createdAt, last.createdAt),
    );
  }

  const startWeight =
    transformation?.currentWeightKg ?? profile?.weightKg ?? null;
  const targetWeight =
    transformation?.targetWeightKg ?? profile?.targetWeightKg ?? null;
  const latestWeight =
    weightTrend.length > 0 ? weightTrend[weightTrend.length - 1].value : null;

  let goalCompletionPercent = 0;
  let transformationPercent = 0;
  if (
    startWeight != null &&
    targetWeight != null &&
    latestWeight != null &&
    startWeight !== targetWeight
  ) {
    const total = startWeight - targetWeight;
    const done = startWeight - latestWeight;
    goalCompletionPercent = Math.min(
      100,
      Math.max(0, Math.round((done / total) * 100)),
    );
    transformationPercent = goalCompletionPercent;
  }

  let etaWeeks: number | null = null;
  let estimatedCompletionDate: string | null = null;
  if (
    latestWeight != null &&
    targetWeight != null &&
    averageWeeklyWeightChange !== 0
  ) {
    const remaining = latestWeight - targetWeight;
    if (remaining === 0) {
      etaWeeks = 0;
      estimatedCompletionDate = toDateKey(new Date());
    } else if (
      (remaining > 0 && averageWeeklyWeightChange < 0) ||
      (remaining < 0 && averageWeeklyWeightChange > 0)
    ) {
      etaWeeks = Math.ceil(Math.abs(remaining / averageWeeklyWeightChange));
      const eta = new Date();
      eta.setUTCDate(eta.getUTCDate() + etaWeeks * 7);
      estimatedCompletionDate = toDateKey(eta);
    }
  } else if (transformation?.estimatedWeeks != null) {
    etaWeeks = transformation.estimatedWeeks;
    const eta = new Date(transformation.createdAt);
    eta.setUTCDate(eta.getUTCDate() + transformation.estimatedWeeks * 7);
    estimatedCompletionDate = toDateKey(eta);
  }

  const currentStreak = computeStreak(logs, checkins);
  const compliancePercent = computeCompliance(mealLogs, checkins);
  const consistencyScore = Math.round(
    currentStreak * 4 + compliancePercent * 0.6,
  );
  const clampedConsistency = Math.min(100, Math.max(0, consistencyScore));

  return {
    weightTrend,
    bodyFatTrend,
    measurementTrends: { waist, chest, arm, thigh },
    weightDifference,
    bodyFatDifference,
    averageWeeklyWeightChange,
    averageMeasurementChange: {
      waist: firstLastDiff(waist),
      chest: firstLastDiff(chest),
      arm: firstLastDiff(arm),
      thigh: firstLastDiff(thigh),
    },
    goalCompletionPercent,
    transformationPercent,
    estimatedCompletionDate,
    consistencyScore: clampedConsistency,
    currentStreak,
    compliancePercent,
    etaWeeks,
    sampleSize: logs.length,
  };
}

function computeStreak(logs: ProgressLog[], checkins: CheckinLite[]) {
  const days = new Set<string>();
  for (const log of logs) {
    days.add(toDateKey(log.createdAt));
  }
  for (const c of checkins) {
    days.add(toDateKey(c.checkInDate));
  }
  if (days.size === 0) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!days.has(toDateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function computeCompliance(mealLogs: MealLogLite[], checkins: CheckinLite[]) {
  const mealTotal = mealLogs.length;
  const mealDone = mealLogs.filter(
    (l) => l.status === 'completed' || l.status === 'replaced',
  ).length;

  const checkinTotal = checkins.length;
  const workoutDone = checkins.filter((c) => c.workoutCompleted).length;

  if (mealTotal === 0 && checkinTotal === 0) {
    return 0;
  }

  const mealScore = mealTotal === 0 ? 0 : (mealDone / mealTotal) * 100;
  const workoutScore =
    checkinTotal === 0 ? 0 : (workoutDone / checkinTotal) * 100;

  if (mealTotal > 0 && checkinTotal > 0) {
    return Math.round(mealScore * 0.6 + workoutScore * 0.4);
  }
  return Math.round(mealTotal > 0 ? mealScore : workoutScore);
}
