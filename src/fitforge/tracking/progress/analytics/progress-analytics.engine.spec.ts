import {
  buildInsights,
  computeProgressAnalytics,
} from './progress-analytics.engine';
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
    expect(result.insights.tone).toBe('insufficient_data');
  });

  it('computes weight trend, weekly change, and narrative insights', () => {
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
      workoutSessions: [
        { status: 'completed', completedAt: end, createdAt: end },
      ],
    });

    expect(result.weightDifference).toBe(-6);
    expect(result.averageWeeklyWeightChange).toBeLessThan(0);
    expect(result.goalCompletionPercent).toBeGreaterThan(0);
    expect(result.weightTrend).toHaveLength(3);
    expect(result.compliancePercent).toBeGreaterThan(0);
    expect(result.insights.headline).toMatch(/lost 6kg/i);
    expect(result.insights.complianceLine).toMatch(/compliance is/i);
    expect(result.insights.summary.length).toBeGreaterThan(20);
    expect(result.weeksTracked).toBeGreaterThan(3);
  });
});

describe('buildInsights', () => {
  it('says weeks earlier when ahead of plan', () => {
    const insights = buildInsights({
      weightDifference: -3.2,
      weeksTracked: 5,
      compliancePercent: 91,
      weeksAheadOfPlan: 2,
      etaWeeks: 8,
      goalCompletionPercent: 40,
      currentStreak: 6,
      averageWeeklyWeightChange: -0.6,
      bodyFatDifference: -1.2,
      sampleSize: 5,
      latestWeightKg: 84,
      targetWeightKg: 75,
    });

    expect(insights.headline).toBe("You've lost 3.2kg in 5 weeks.");
    expect(insights.complianceLine).toBe('Your compliance is 91%.');
    expect(insights.paceLine).toBe(
      "At this pace you'll reach your goal 2 weeks earlier.",
    );
    expect(insights.tone).toBe('ahead');
  });
});
