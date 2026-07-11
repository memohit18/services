import {
  COMPLIANT_DAY_MIN_SCORE,
  computeDayScore,
  type DayScoreInput,
} from '../../dashboard/engines/score.engine';

export type ComplianceDayInput = DayScoreInput & {
  date: string;
  dietCompliance: number | null;
};

export type ComplianceBreakdown = {
  overall: number;
  meals: number;
  workout: number;
  calories: number;
  protein: number;
  water: number;
  dietCompliance: number;
};

export type StreakResult = {
  currentStreak: number;
  longestStreak: number;
  lastCompliantDate: string | null;
  compliantToday: boolean;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

export function isCompliantDay(score: number): boolean {
  return score >= COMPLIANT_DAY_MIN_SCORE;
}

export function computeComplianceBreakdown(
  input: DayScoreInput & { dietCompliance?: number | null },
): ComplianceBreakdown {
  const scored = computeDayScore(input);
  return {
    overall: scored.todayScore,
    meals: scored.breakdown.meals,
    workout: scored.breakdown.workout,
    calories: scored.breakdown.calories,
    protein: scored.breakdown.protein,
    water: scored.breakdown.water,
    dietCompliance: input.dietCompliance ?? scored.breakdown.meals,
  };
}

/**
 * Expects dates sorted descending (newest first) as YYYY-MM-DD.
 * Counts consecutive compliant days ending at `today` (or yesterday if today not yet compliant).
 */
export function computeStreak(
  days: Array<{ date: string; score: number }>,
  today: string,
): StreakResult {
  const byDate = new Map(days.map((d) => [d.date, d.score]));
  const sortedAsc = [...byDate.keys()].sort();

  let longest = 0;
  let run = 0;
  for (const date of sortedAsc) {
    if (isCompliantDay(byDate.get(date) ?? 0)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  let cursor = today;
  let lastCompliantDate: string | null = null;

  // Allow streak to continue from yesterday if today isn't compliant yet.
  if (!isCompliantDay(byDate.get(today) ?? 0)) {
    cursor = shiftDate(today, -1);
  }

  while (byDate.has(cursor) && isCompliantDay(byDate.get(cursor) ?? 0)) {
    current += 1;
    lastCompliantDate = lastCompliantDate ?? cursor;
    cursor = shiftDate(cursor, -1);
  }

  // If we started from yesterday, lastCompliantDate should be the most recent compliant day.
  if (isCompliantDay(byDate.get(today) ?? 0)) {
    lastCompliantDate = today;
  } else if (lastCompliantDate == null) {
    for (const date of [...byDate.keys()].sort().reverse()) {
      if (isCompliantDay(byDate.get(date) ?? 0)) {
        lastCompliantDate = date;
        break;
      }
    }
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(longest, current),
    lastCompliantDate,
    compliantToday: isCompliantDay(byDate.get(today) ?? 0),
  };
}

export function deriveAchievements(input: {
  todayScore: number;
  currentStreak: number;
  longestStreak: number;
  workoutCompleted: boolean;
  mealsCompleted: number;
  mealsAssigned: number;
  waterPercent: number;
  totalCompliantDays: number;
  today: string;
}): Achievement[] {
  const perfectMeals =
    input.mealsAssigned > 0 && input.mealsCompleted >= input.mealsAssigned;

  return [
    {
      id: 'first_workout',
      title: 'First Workout',
      description: 'Complete a workout session',
      unlocked: input.workoutCompleted || input.totalCompliantDays > 0,
      unlockedAt:
        input.workoutCompleted || input.totalCompliantDays > 0
          ? input.today
          : null,
    },
    {
      id: 'hydration_hero',
      title: 'Hydration Hero',
      description: 'Hit 100% of your water target',
      unlocked: input.waterPercent >= 100,
      unlockedAt: input.waterPercent >= 100 ? input.today : null,
    },
    {
      id: 'meal_perfection',
      title: 'Meal Perfection',
      description: 'Complete all assigned meals today',
      unlocked: perfectMeals,
      unlockedAt: perfectMeals ? input.today : null,
    },
    {
      id: 'perfect_day',
      title: 'Perfect Day',
      description: 'Reach a 100 daily score',
      unlocked: input.todayScore >= 100,
      unlockedAt: input.todayScore >= 100 ? input.today : null,
    },
    {
      id: 'streak_3',
      title: '3-Day Streak',
      description: 'Stay compliant for 3 days in a row',
      unlocked: input.currentStreak >= 3 || input.longestStreak >= 3,
      unlockedAt:
        input.currentStreak >= 3 || input.longestStreak >= 3
          ? input.today
          : null,
    },
    {
      id: 'streak_7',
      title: '7-Day Streak',
      description: 'Stay compliant for 7 days in a row',
      unlocked: input.currentStreak >= 7 || input.longestStreak >= 7,
      unlockedAt:
        input.currentStreak >= 7 || input.longestStreak >= 7
          ? input.today
          : null,
    },
  ];
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
