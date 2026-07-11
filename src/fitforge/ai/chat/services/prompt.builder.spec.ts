import { PromptBuilder } from './prompt.builder';
import type { CoachContext } from './ai-context.builder';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  const baseCtx = (): CoachContext => ({
    contextVersion: 'coach-v3',
    user: { name: 'Mohit' },
    profile: null,
    transformation: null,
    nutritionPreference: null,
    activeDiet: null,
    activeWorkout: null,
    todayMeals: [
      {
        mealType: 'lunch',
        foodName: 'Chicken bowl',
        status: 'skipped',
        calories: 0,
        protein: 0,
      },
    ],
    todayWaterMl: 750,
    workoutProgress: {
      sessionId: null,
      status: null,
      dayTitle: null,
      exercisesPlanned: 0,
      exercisesCompleted: 0,
      exercisesSkipped: 0,
      setsLogged: 0,
      workoutCompletedToday: false,
    },
    latestProgress: null,
    recentProgress: [],
    latestCheckin: null,
    recentCheckins: [],
    foodPreferences: [],
    compliancePercent: 42,
    dayScore: {
      todayScore: 42,
      breakdown: {
        meals: 0,
        workout: 0,
        calories: 0,
        protein: 0,
        water: 19,
      },
      weights: {
        meals: 0.3,
        workout: 0.3,
        calories: 0.15,
        protein: 0.15,
        water: 0.1,
      },
      remainingCalories: 2200,
      remainingProtein: 150,
      calorieTarget: 2200,
      proteinTarget: 150,
      waterTargetMl: 4000,
    },
    streak: {
      currentStreak: 2,
      longestStreak: 5,
      lastCompliantDate: '2026-07-10',
      compliantToday: false,
    },
  });

  it('includes meals, water, compliance, and streak from context only', () => {
    const prompt = builder.build(baseCtx(), [], 'I skipped lunch.');
    expect(prompt).toContain('I skipped lunch.');
    expect(prompt).toContain('Chicken bowl');
    expect(prompt).toContain('750 ml');
    expect(prompt).toContain('coach-v3');
    expect(prompt).toContain('Current Streak');
    expect(prompt).toContain('Current: 2 day(s)');
    expect(prompt).toContain('Overall score: 42%');
    expect(prompt).toContain('Remaining today: 2200 kcal');
  });
});
