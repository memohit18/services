import { mapAiDietToDietPlan } from './diet-mapper';
import type { AiDietResponse } from './diet-response.schema';

describe('mapAiDietToDietPlan', () => {
  it('maps validated AI JSON into diet_plan audit fields', () => {
    const response: AiDietResponse = {
      goal: 'Fat Loss',
      dailyCalories: 2200,
      dailyProtein: 160,
      dailyCarbs: 220,
      dailyFats: 60,
      meals: [
        {
          dayNumber: 1,
          mealType: 'breakfast',
          foodName: 'Poha',
          quantity: 1,
        },
      ],
    };

    const mapped = mapAiDietToDietPlan({
      response,
      prompt: 'test-prompt',
      metadata: {
        provider: 'gemini',
        model: 'gemini-2.5-flash-lite',
        promptVersion: 1,
        attempts: 1,
      },
    });

    expect(mapped.prompt).toBe('test-prompt');
    expect(mapped.responseJson).toEqual(response);
    expect(mapped.caloriesTarget).toBe(2200);
    expect(mapped.generatedBy).toBe('ai');
    expect(mapped.aiMetadata).toMatchObject({
      provider: 'gemini',
      promptVersion: 1,
    });
  });
});
