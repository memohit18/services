import { BadRequestException } from '@nestjs/common';
import { DietResponseValidator } from './diet-response.validator';

describe('DietResponseValidator', () => {
  const validator = new DietResponseValidator();

  const baseCtx = {
    engineCalories: 2200,
    engineProtein: 160,
    restrictedFoods: ['Samosa'],
    allowedFoodNames: ['Poha', 'Dal Rice', 'Paneer Bhurji', 'Apple'],
  };

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
      {
        dayNumber: 1,
        mealType: 'lunch',
        foodName: 'Dal Rice',
        quantity: 1,
      },
    ],
  };

  it('accepts a valid AI diet response', () => {
    const result = validator.validate(valid, baseCtx);
    expect(result.goal).toBe('Fat Loss');
    expect(result.meals).toHaveLength(2);
  });

  it('rejects missing meals', () => {
    expect(() =>
      validator.validate({ ...valid, meals: [] }, baseCtx),
    ).toThrow(BadRequestException);
  });

  it('rejects restricted foods', () => {
    expect(() =>
      validator.validate(
        {
          ...valid,
          meals: [
            {
              dayNumber: 1,
              mealType: 'snack',
              foodName: 'Samosa',
              quantity: 1,
            },
          ],
        },
        baseCtx,
      ),
    ).toThrow(/restricted food/i);
  });

  it('rejects unknown foods', () => {
    expect(() =>
      validator.validate(
        {
          ...valid,
          meals: [
            {
              dayNumber: 1,
              mealType: 'dinner',
              foodName: 'Unknown Dish',
              quantity: 1,
            },
          ],
        },
        baseCtx,
      ),
    ).toThrow(/unknown food/i);
  });

  it('rejects macros far from engine targets', () => {
    expect(() =>
      validator.validate({ ...valid, dailyCalories: 3500 }, baseCtx),
    ).toThrow(/outside 10%/i);
  });
});
