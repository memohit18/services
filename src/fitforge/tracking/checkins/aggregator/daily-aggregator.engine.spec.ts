import {
  aggregateDailyCheckin,
  startOfLocalCalendarDay,
} from './daily-aggregator.engine';

describe('aggregateDailyCheckin', () => {
  it('sums hydration and derives meal compliance', () => {
    const result = aggregateDailyCheckin({
      mealLogs: [
        { status: 'completed', actualCalories: 400, actualProtein: 30 },
        { status: 'skipped', actualCalories: null, actualProtein: null },
        { status: 'replaced', actualCalories: 350, actualProtein: 25 },
      ],
      hydrationLogs: [{ amountMl: 250 }, { amountMl: 500 }],
      workoutSessions: [{ status: 'completed' }],
      progressLogs: [{ weightKg: 78.5, notes: 'good day' }],
      dietPlanId: 'diet-1',
      workoutPlanId: 'workout-1',
    });

    expect(result.waterIntakeMl).toBe(750);
    expect(result.mealsCompleted).toBe(2);
    expect(result.mealsSkipped).toBe(1);
    expect(result.dietCompliance).toBe(67);
    expect(result.caloriesConsumed).toBe(750);
    expect(result.proteinConsumed).toBe(55);
    expect(result.workoutCompleted).toBe(true);
    expect(result.weightKg).toBe(78.5);
    expect(result.notes).toBe('good day');
    expect(result.dietPlanId).toBe('diet-1');
  });

  it('marks workout incomplete when only skipped sessions exist', () => {
    const result = aggregateDailyCheckin({
      mealLogs: [],
      hydrationLogs: [],
      workoutSessions: [{ status: 'skipped' }],
      progressLogs: [],
      dietPlanId: null,
      workoutPlanId: null,
    });
    expect(result.workoutCompleted).toBe(false);
  });
});

describe('startOfLocalCalendarDay', () => {
  it('returns UTC midnight for local calendar components', () => {
    const d = new Date(2026, 6, 10, 15, 30, 0);
    const start = startOfLocalCalendarDay(d);
    expect(start.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });
});
