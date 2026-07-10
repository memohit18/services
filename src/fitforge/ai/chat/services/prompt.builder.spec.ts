import { PromptBuilder } from './prompt.builder';
import type { CoachContext } from './ai-context.builder';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  it('includes today meals and water from context only', () => {
    const ctx: CoachContext = {
      contextVersion: 'coach-v2',
      user: { name: 'Mohit' },
      profile: null,
      transformation: null,
      nutritionPreference: null,
      activeDiet: null,
      activeWorkout: null,
      todayMeals: [
        {
          mealType: 'breakfast',
          foodName: 'Oats',
          status: 'skipped',
          calories: 0,
          protein: 0,
        },
      ],
      todayWaterMl: 750,
      latestProgress: null,
      recentProgress: [],
      latestCheckin: null,
      recentCheckins: [],
      foodPreferences: [],
      compliancePercent: 50,
    };

    const prompt = builder.build(ctx, [], 'I skipped breakfast.');
    expect(prompt).toContain('I skipped breakfast.');
    expect(prompt).toContain('Oats');
    expect(prompt).toContain('750 ml');
    expect(prompt).toContain('coach-v2');
  });
});
