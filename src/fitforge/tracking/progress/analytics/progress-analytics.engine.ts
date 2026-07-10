import type {
  ProgressLog,
  TransformationTarget,
  UserFitnessProfile,
} from '@prisma/client';

export type ProgressTrendPoint = {
  date: string;
  value: number;
};

export type ProgressInsightTone =
  | 'ahead'
  | 'on_track'
  | 'behind'
  | 'starting'
  | 'insufficient_data';

export type ProgressInsights = {
  headline: string;
  complianceLine: string;
  paceLine: string | null;
  summary: string;
  bullets: string[];
  tone: ProgressInsightTone;
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
  /** Weeks of progress data covered by weight logs */
  weeksTracked: number;
  /** Transformation plan ETA (weeks) at creation */
  plannedEtaWeeks: number | null;
  /** Positive = ahead of plan (finish earlier) */
  weeksAheadOfPlan: number | null;
  latestWeightKg: number | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  sampleSize: number;
  insights: ProgressInsights;
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

type WorkoutSessionLite = {
  status: string;
  completedAt: Date | null;
  createdAt: Date;
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
  workoutSessions?: WorkoutSessionLite[];
}): ProgressAnalyticsResult {
  const {
    logs,
    transformation,
    profile,
    mealLogs,
    checkins,
    workoutSessions = [],
  } = input;

  const weightTrend = series(logs, (l) => l.weightKg);
  const bodyFatTrend = series(logs, (l) => l.bodyFatPercentage);
  const waist = series(logs, (l) => l.waistCm);
  const chest = series(logs, (l) => l.chestCm);
  const arm = series(logs, (l) => l.armCm);
  const thigh = series(logs, (l) => l.thighCm);

  const weightDifference = firstLastDiff(weightTrend);
  const bodyFatDifference = firstLastDiff(bodyFatTrend);

  let averageWeeklyWeightChange = 0;
  let weeksTracked = 0;
  if (weightTrend.length >= 2) {
    const first = logs.find((l) => l.weightKg != null)!;
    const last = [...logs].reverse().find((l) => l.weightKg != null)!;
    weeksTracked = round1(weeksBetween(first.createdAt, last.createdAt));
    averageWeeklyWeightChange = round1(weightDifference / weeksTracked);
  }

  const startWeight =
    transformation?.currentWeightKg ??
    (weightTrend.length > 0 ? weightTrend[0].value : null) ??
    profile?.weightKg ??
    null;
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

  const plannedEtaWeeks = transformation?.estimatedWeeks ?? null;
  let weeksAheadOfPlan: number | null = null;
  if (plannedEtaWeeks != null && etaWeeks != null && weeksTracked > 0) {
    // Remaining plan weeks vs projected remaining weeks
    const elapsedPlanWeeks = weeksTracked;
    const plannedRemaining = Math.max(0, plannedEtaWeeks - elapsedPlanWeeks);
    weeksAheadOfPlan = round1(plannedRemaining - etaWeeks);
  }

  const currentStreak = computeStreak(logs, checkins, workoutSessions);
  const compliancePercent = computeCompliance(
    mealLogs,
    checkins,
    workoutSessions,
  );
  const consistencyScore = Math.round(
    currentStreak * 4 + compliancePercent * 0.6,
  );
  const clampedConsistency = Math.min(100, Math.max(0, consistencyScore));

  const metrics = {
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
    weeksTracked,
    plannedEtaWeeks,
    weeksAheadOfPlan,
    latestWeightKg: latestWeight,
    startWeightKg: startWeight,
    targetWeightKg: targetWeight,
    sampleSize: logs.length,
  };

  return {
    ...metrics,
    insights: buildInsights(metrics),
  };
}

export function buildInsights(input: {
  weightDifference: number;
  weeksTracked: number;
  compliancePercent: number;
  weeksAheadOfPlan: number | null;
  etaWeeks: number | null;
  goalCompletionPercent: number;
  currentStreak: number;
  averageWeeklyWeightChange: number;
  bodyFatDifference: number;
  sampleSize: number;
  latestWeightKg: number | null;
  targetWeightKg: number | null;
}): ProgressInsights {
  if (input.sampleSize === 0) {
    return {
      headline: 'Log your first weigh-in to unlock transformation insights.',
      complianceLine: 'Compliance will appear once you start logging meals and workouts.',
      paceLine: null,
      summary:
        'Log your first weigh-in to unlock transformation insights. Compliance will appear once you start logging meals and workouts.',
      bullets: [
        'Add today’s weight under Progress',
        'Complete meals and workouts to build compliance',
      ],
      tone: 'insufficient_data',
    };
  }

  if (input.weeksTracked < 0.5 || input.sampleSize < 2) {
    const weightBit =
      input.latestWeightKg != null
        ? `Latest weight: ${round1(input.latestWeightKg)}kg.`
        : 'Keep logging to reveal your trend.';
    return {
      headline: weightBit,
      complianceLine: `Your compliance is ${input.compliancePercent}%.`,
      paceLine: null,
      summary: `${weightBit} Your compliance is ${input.compliancePercent}%. Keep logging for a clearer pace forecast.`,
      bullets: [
        `Compliance ${input.compliancePercent}%`,
        `Current streak ${input.currentStreak} day${input.currentStreak === 1 ? '' : 's'}`,
      ],
      tone: 'starting',
    };
  }

  const absKg = Math.abs(input.weightDifference);
  const weeksLabel = formatWeeks(input.weeksTracked);
  let headline: string;
  if (input.weightDifference < -0.1) {
    headline = `You've lost ${absKg}kg in ${weeksLabel}.`;
  } else if (input.weightDifference > 0.1) {
    headline = `You've gained ${absKg}kg in ${weeksLabel}.`;
  } else {
    headline = `Your weight has held steady over ${weeksLabel}.`;
  }

  const complianceLine = `Your compliance is ${input.compliancePercent}%.`;

  let paceLine: string | null = null;
  let tone: ProgressInsightTone = 'on_track';

  if (input.weeksAheadOfPlan != null && input.etaWeeks != null) {
    if (input.weeksAheadOfPlan >= 1) {
      tone = 'ahead';
      paceLine = `At this pace you'll reach your goal ${formatWeeks(input.weeksAheadOfPlan)} earlier.`;
    } else if (input.weeksAheadOfPlan <= -1) {
      tone = 'behind';
      paceLine = `At this pace you're about ${formatWeeks(Math.abs(input.weeksAheadOfPlan))} behind plan — a small consistency bump closes the gap.`;
    } else {
      tone = 'on_track';
      paceLine = `At this pace you're right on schedule (~${formatWeeks(input.etaWeeks)} remaining).`;
    }
  } else if (input.etaWeeks != null && input.etaWeeks > 0) {
    paceLine = `At this pace you'll reach your goal in about ${formatWeeks(input.etaWeeks)}.`;
    tone = 'on_track';
  }

  const bullets: string[] = [
    headline,
    complianceLine,
    `Goal completion ${input.goalCompletionPercent}%`,
    `Streak ${input.currentStreak} day${input.currentStreak === 1 ? '' : 's'}`,
  ];
  if (paceLine) {
    bullets.push(paceLine);
  }
  if (input.bodyFatDifference !== 0) {
    const bfAbs = Math.abs(input.bodyFatDifference);
    bullets.push(
      input.bodyFatDifference < 0
        ? `Body fat down ${bfAbs}%`
        : `Body fat up ${bfAbs}%`,
    );
  }

  const summary = [headline, complianceLine, paceLine]
    .filter(Boolean)
    .join(' ');

  return {
    headline,
    complianceLine,
    paceLine,
    summary,
    bullets,
    tone,
  };
}

function formatWeeks(weeks: number): string {
  const rounded = round1(weeks);
  if (rounded === 1) {
    return '1 week';
  }
  if (Number.isInteger(rounded)) {
    return `${rounded} weeks`;
  }
  return `${rounded} weeks`;
}

function computeStreak(
  logs: ProgressLog[],
  checkins: CheckinLite[],
  workoutSessions: WorkoutSessionLite[],
) {
  const days = new Set<string>();
  for (const log of logs) {
    days.add(toDateKey(log.createdAt));
  }
  for (const c of checkins) {
    days.add(toDateKey(c.checkInDate));
  }
  for (const s of workoutSessions) {
    if (s.status === 'completed' || s.status === 'partial') {
      days.add(toDateKey(s.completedAt ?? s.createdAt));
    }
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

function computeCompliance(
  mealLogs: MealLogLite[],
  checkins: CheckinLite[],
  workoutSessions: WorkoutSessionLite[],
) {
  const mealTotal = mealLogs.length;
  const mealDone = mealLogs.filter(
    (l) => l.status === 'completed' || l.status === 'replaced',
  ).length;

  const checkinTotal = checkins.length;
  const workoutFromCheckins = checkins.filter((c) => c.workoutCompleted).length;
  const sessionTotal = workoutSessions.length;
  const sessionDone = workoutSessions.filter(
    (s) => s.status === 'completed' || s.status === 'partial',
  ).length;

  const workoutDone = workoutFromCheckins + sessionDone;
  const workoutDenom = checkinTotal + sessionTotal;

  if (mealTotal === 0 && workoutDenom === 0) {
    return 0;
  }

  const mealScore = mealTotal === 0 ? 0 : (mealDone / mealTotal) * 100;
  const workoutScore =
    workoutDenom === 0 ? 0 : (workoutDone / workoutDenom) * 100;

  if (mealTotal > 0 && workoutDenom > 0) {
    return Math.round(mealScore * 0.6 + workoutScore * 0.4);
  }
  return Math.round(mealTotal > 0 ? mealScore : workoutScore);
}
