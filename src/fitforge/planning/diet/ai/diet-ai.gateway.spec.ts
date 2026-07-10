import { DietAiGateway } from './diet-ai.gateway';
import type { DietAiProvider } from './diet-ai.provider';
import { DietResponseValidator } from './diet-response.validator';
import type { GeminiService } from '../../../ai/gemini/gemini.service';

describe('DietAiGateway', () => {
  const valid = {
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

  const ctx = {
    engineCalories: 2200,
    engineProtein: 160,
    restrictedFoods: [],
    allowedFoodNames: ['Poha'],
  };

  it('retries once when first response fails validation', async () => {
    const provider: DietAiProvider = {
      name: 'gemini',
      generateDiet: jest
        .fn()
        .mockResolvedValueOnce({ bad: true })
        .mockResolvedValueOnce(valid),
    };

    const gemini = {
      getLastUsedProvider: () => 'gemini',
      getLastUsedModel: () => 'gemini-2.5-flash-lite',
    } as unknown as GeminiService;

    const gateway = new DietAiGateway(
      provider,
      new DietResponseValidator(),
      gemini,
    );

    const result = await gateway.generateDiet('prompt', ctx);
    expect(result.response.goal).toBe('Fat Loss');
    expect(result.metadata.attempts).toBe(2);
    expect(provider.generateDiet).toHaveBeenCalledTimes(2);
  });

  it('does not call provider more than twice', async () => {
    const provider: DietAiProvider = {
      name: 'gemini',
      generateDiet: jest.fn().mockResolvedValue({ bad: true }),
    };

    const gemini = {
      getLastUsedProvider: () => 'gemini',
      getLastUsedModel: () => 'x',
    } as unknown as GeminiService;

    const gateway = new DietAiGateway(
      provider,
      new DietResponseValidator(),
      gemini,
    );

    await expect(gateway.generateDiet('prompt', ctx)).rejects.toBeTruthy();
    expect(provider.generateDiet).toHaveBeenCalledTimes(2);
  });
});
