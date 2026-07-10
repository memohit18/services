import { computeProgressAnalytics } from './progress-analytics.engine';
import type { ProgressLog } from '@prisma/client';

function log(
  partial: Partial<ProgressLog> & { createdAt: Date; weightKg?: number | null },
): ProgressLog {
  return {
    id: 'x',
    userId: 'u',
    weightKg: null,
    waistCm: null,
    chestCm: null,
    armCm: null,
    thighCm: null,
    bodyFatPercentage: null,
    notes: null,
    ...partial,
  } as ProgressLog;
}

describe('computeProgressAnalytics', () => {
  it('returns empty-safe defaults when no logs', () => {
    const result = computeProgressAnalytics({
      logs: [],
      transformation: null,
      profile: null,
      mealLogs: [],
      checkins: [],
    });
    expect(result.sampleSize).toBe(0);
    expect(result.goalCompletionPercent).toBe(0);
    expect(result.weightTrend).toEqual([]);
  });

  it('computes weight trend and weekly change toward goal', () => {
    const start = new Date('2026-06-01T00:00:00.000Z');
    const mid = new Date('2026-06-15T00:00:00.000Z');
    const end = new Date('2026-06-29T00:00:00.000Z');

    const result = computeProgressAnalytics({
      logs: [
        log({ createdAt: start, weightKg: 90 }),
        log({ createdAt: mid, weightKg: 87 }),
        log({ createdAt: end, weightKg: 84 }),
      ],
      transformation: {
        id: 't1',
        userId: 'u',
        currentWeightKg: 90,
        targetWeightKg: 75,
        currentBodyFat: null,
        targetBodyFat: null,
        estimatedWeeks: 20,
        targetPhysique: null,
        status: 'active',
        bmi: null,
        bmr: null,
        tdee: null,
        dailyCalorieTarget: null,
        proteinTarget: null,
        createdAt: start,
        updatedAt: start,
      },
      profile: null,
      mealLogs: [
        { status: 'completed', consumedAt: end },
        { status: 'skipped', consumedAt: end },
      ],
      checkins: [
        {
          checkInDate: end,
          workoutCompleted: true,
          mealsCompleted: 3,
          mealsSkipped: 1,
        },
      ],
    });

    expect(result.weightDifference).toBe(-6);
    expect(result.averageWeeklyWeightChange).toBeLessThan(0);
    expect(result.goalCompletionPercent).toBeGreaterThan(0);
    expect(result.weightTrend).toHaveLength(3);
    expect(result.compliancePercent).toBeGreaterThan(0);
  });
});
