import { BadRequestException } from '@nestjs/common';
import { validateDietTargetsResponse, normalizeDietTargets } from './diet-targets.pipeline';
import { validateMealPlanResponse, normalizeMealPlanItems } from './meal-plan.pipeline';
import { validateWorkoutPlanResponse, normalizeWorkoutPlan } from './workout-plan.pipeline';

describe('AI pipeline validators', () => {
  describe('validateDietTargetsResponse', () => {
    const valid = {
      carbs: 200,
      fats: 60,
      mealDistribution: {
        breakfast: {
          caloriesPercent: 25,
          proteinPercent: 25,
          carbsPercent: 25,
          fatsPercent: 25,
        },
        lunch: {
          caloriesPercent: 35,
          proteinPercent: 35,
          carbsPercent: 35,
          fatsPercent: 35,
        },
        snack: {
          caloriesPercent: 10,
          proteinPercent: 10,
          carbsPercent: 10,
          fatsPercent: 10,
        },
        dinner: {
          caloriesPercent: 30,
          proteinPercent: 30,
          carbsPercent: 30,
          fatsPercent: 30,
        },
      },
    };

    it('accepts a valid payload', () => {
      expect(validateDietTargetsResponse(valid).carbs).toBe(200);
    });

    it('rejects missing mealDistribution', () => {
      expect(() =>
        validateDietTargetsResponse({ carbs: 100, fats: 40 }),
      ).toThrow(BadRequestException);
    });

    it('rejects negative carbs', () => {
      expect(() =>
        validateDietTargetsResponse({ ...valid, carbs: -1 }),
      ).toThrow(BadRequestException);
    });
  });

  describe('normalizeDietTargets', () => {
    it('rounds macros when within engine remaining calories', () => {
      const result = normalizeDietTargets(
        {
          carbs: 250.4,
          fats: 66.6,
          mealDistribution: {
            breakfast: {
              caloriesPercent: 25,
              proteinPercent: 25,
              carbsPercent: 25,
              fatsPercent: 25,
            },
            lunch: {
              caloriesPercent: 35,
              proteinPercent: 35,
              carbsPercent: 35,
              fatsPercent: 35,
            },
            snack: {
              caloriesPercent: 10,
              proteinPercent: 10,
              carbsPercent: 10,
              fatsPercent: 10,
            },
            dinner: {
              caloriesPercent: 30,
              proteinPercent: 30,
              carbsPercent: 30,
              fatsPercent: 30,
            },
          },
        },
        { dailyCalories: 2200, proteinTarget: 150 },
      );
      // remaining kcal = 2200 - 150*4 = 1600; 250*4 + 67*9 ≈ 1603
      expect(result.carbs).toBe(250);
      expect(result.fats).toBe(67);
    });
  });

  describe('validateMealPlanResponse', () => {
    it('accepts days with meal names', () => {
      const result = validateMealPlanResponse({
        days: [{ day: 1, breakfast: 'Poha', lunch: 'Dal' }],
      });
      expect(result.days).toHaveLength(1);
    });

    it('rejects empty days', () => {
      expect(() => validateMealPlanResponse({ days: [] })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('normalizeMealPlanItems', () => {
    it('flattens meal names into items', () => {
      const items = normalizeMealPlanItems({
        days: [
          {
            day: 1,
            breakfast: 'Poha',
            lunch: 'Dal Rice',
            snack: undefined,
            dinner: 'Paneer',
          },
        ],
      });
      expect(items).toEqual([
        { dayNumber: 1, mealType: 'breakfast', foodName: 'Poha' },
        { dayNumber: 1, mealType: 'lunch', foodName: 'Dal Rice' },
        { dayNumber: 1, mealType: 'dinner', foodName: 'Paneer' },
      ]);
    });
  });

  describe('validateWorkoutPlanResponse', () => {
    it('accepts a valid workout plan', () => {
      const result = validateWorkoutPlanResponse({
        days: [
          {
            dayNumber: 1,
            title: 'Push',
            exercises: [
              { name: 'Bench Press', sets: 4, reps: '8-12', restSeconds: 90 },
            ],
          },
        ],
      });
      expect(result.days[0].exercises[0].name).toBe('Bench Press');
    });

    it('rejects days without exercises', () => {
      expect(() =>
        validateWorkoutPlanResponse({
          days: [{ dayNumber: 1, title: 'Push', exercises: [] }],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('normalizeWorkoutPlan', () => {
    it('applies fallbacks', () => {
      const result = normalizeWorkoutPlan(
        {
          days: [
            {
              dayNumber: 1,
              title: ' Push ',
              exercises: [
                { name: ' Squats ', sets: 3, reps: '10', restSeconds: 60 },
              ],
            },
          ],
        },
        5,
        'muscle_gain',
      );
      expect(result.goal).toBe('muscle_gain');
      expect(result.daysPerWeek).toBe(5);
      expect(result.days[0].title).toBe('Push');
      expect(result.days[0].exercises[0].name).toBe('Squats');
    });
  });
});
