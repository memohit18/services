import { BadRequestException } from '@nestjs/common';
import { MealPlanNormalizer } from './meal-plan-normalizer.service';
import type { MealPlanRepository } from '../repositories/meal-plan.repository';
import type { AiDietResponse } from '../../diet/ai/diet-response.schema';

describe('MealPlanNormalizer', () => {
  const prisma = {
    dietPlan: {
      findFirst: jest.fn(),
    },
    foodMaster: {
      findMany: jest.fn(),
    },
  };

  const mealPlanRepository = {
    latestVersion: jest.fn(),
    createActiveWithItems: jest.fn(),
  } as unknown as MealPlanRepository;

  const normalizer = new MealPlanNormalizer(
    prisma as never,
    mealPlanRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes AI meals into meal plan items with macros', async () => {
    const response: AiDietResponse = {
      goal: 'Fat Loss',
      dailyCalories: 2200,
      dailyProtein: 160,
      dailyCarbs: 200,
      dailyFats: 70,
      meals: [
        {
          dayNumber: 1,
          mealType: 'breakfast',
          foodName: 'Poha',
          quantity: 2,
        },
      ],
    };

    (prisma.foodMaster.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'food-1',
        name: 'Poha',
        calories: 100,
        protein: 5,
        carbs: 20,
        fats: 2,
      },
    ]);

    const items = await normalizer.normalizeMeals('user-1', response);
    expect(items).toEqual([
      {
        dayNumber: 1,
        mealType: 'breakfast',
        foodId: 'food-1',
        quantity: 2,
        calories: 200,
        protein: 10,
        carbs: 40,
        fats: 4,
      },
    ]);
  });

  it('rejects unknown foods', async () => {
    (prisma.foodMaster.findMany as jest.Mock).mockResolvedValue([]);
    await expect(
      normalizer.normalizeMeals('user-1', {
        goal: 'x',
        dailyCalories: 2000,
        dailyProtein: 100,
        dailyCarbs: 200,
        dailyFats: 50,
        meals: [
          {
            dayNumber: 1,
            mealType: 'lunch',
            foodName: 'Unknown',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
