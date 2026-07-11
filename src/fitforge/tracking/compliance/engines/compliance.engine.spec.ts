import {
  computeComplianceBreakdown,
  computeStreak,
  deriveAchievements,
  isCompliantDay,
} from './compliance.engine';

describe('isCompliantDay', () => {
  it('requires score >= 60', () => {
    expect(isCompliantDay(59)).toBe(false);
    expect(isCompliantDay(60)).toBe(true);
  });
});

describe('computeComplianceBreakdown', () => {
  it('mirrors score engine overall as compliance', () => {
    const result = computeComplianceBreakdown({
      mealsCompleted: 2,
      mealsAssigned: 2,
      workoutCompleted: true,
      caloriesConsumed: 2000,
      calorieTarget: 2000,
      proteinConsumed: 140,
      proteinTarget: 140,
      waterMl: 4000,
      dietCompliance: 100,
    });
    expect(result.overall).toBe(100);
    expect(result.dietCompliance).toBe(100);
  });
});

describe('computeStreak', () => {
  it('counts consecutive compliant days ending today', () => {
    const streak = computeStreak(
      [
        { date: '2026-07-11', score: 80 },
        { date: '2026-07-10', score: 70 },
        { date: '2026-07-09', score: 65 },
        { date: '2026-07-08', score: 40 },
      ],
      '2026-07-11',
    );
    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
    expect(streak.compliantToday).toBe(true);
    expect(streak.lastCompliantDate).toBe('2026-07-11');
  });

  it('keeps streak from yesterday when today is not yet compliant', () => {
    const streak = computeStreak(
      [
        { date: '2026-07-11', score: 20 },
        { date: '2026-07-10', score: 80 },
        { date: '2026-07-09', score: 75 },
      ],
      '2026-07-11',
    );
    expect(streak.currentStreak).toBe(2);
    expect(streak.compliantToday).toBe(false);
  });
});

describe('deriveAchievements', () => {
  it('unlocks streak and meal achievements', () => {
    const achievements = deriveAchievements({
      todayScore: 100,
      currentStreak: 3,
      longestStreak: 3,
      workoutCompleted: true,
      mealsCompleted: 3,
      mealsAssigned: 3,
      waterPercent: 100,
      totalCompliantDays: 3,
      today: '2026-07-11',
    });
    const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
    expect(unlocked).toEqual(
      expect.arrayContaining([
        'first_workout',
        'hydration_hero',
        'meal_perfection',
        'perfect_day',
        'streak_3',
      ]),
    );
  });
});
