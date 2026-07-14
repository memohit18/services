import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { FoodsRepository } from '../repositories/foods.repository';
import { MealPlansService } from '../../../planning/meal-plans/services/meal-plans.service';

describe('FoodsService', () => {
  const foodsRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  } as unknown as FoodsRepository;

  const mealPlansService = {
    rebuildActiveFromAvailableFoods: jest.fn().mockResolvedValue(null),
  } as unknown as MealPlansService;

  const service = new FoodsService(foodsRepository, mealPlansService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates category on custom food for owner', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue({
      id: 'food-1',
      isCustom: true,
      createdByUserId: 'user-1',
    });
    (foodsRepository.update as jest.Mock).mockResolvedValue({
      id: 'food-1',
      category: 'grain',
    });

    const result = await service.update('user-1', 'user', 'food-1', {
      category: 'carbs',
    });

    expect(foodsRepository.update).toHaveBeenCalledWith('food-1', {
      category: 'grain',
    });
    expect(result.category).toBe('grain');
  });

  it('removes category when null is sent', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue({
      id: 'food-1',
      isCustom: true,
      createdByUserId: 'user-1',
    });
    (foodsRepository.update as jest.Mock).mockResolvedValue({
      id: 'food-1',
      category: null,
    });

    await service.update('user-1', 'user', 'food-1', { category: null });

    expect(foodsRepository.update).toHaveBeenCalledWith('food-1', {
      category: null,
    });
  });

  it('blocks non-owner from updating custom food', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue({
      id: 'food-1',
      isCustom: true,
      createdByUserId: 'user-2',
    });

    await expect(
      service.update('user-1', 'user', 'food-1', { category: 'protein' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks non-admin from updating catalog food', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue({
      id: 'food-1',
      isCustom: false,
      createdByUserId: null,
    });

    await expect(
      service.update('user-1', 'user', 'food-1', { category: 'protein' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when food is missing', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.update('user-1', 'user', 'missing', { category: 'protein' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes food used in meal plans and queues rebuild', async () => {
    (foodsRepository.findById as jest.Mock).mockResolvedValue({
      id: 'food-1',
      isCustom: false,
      createdByUserId: null,
      name: 'Paneer',
    });
    (foodsRepository.delete as jest.Mock).mockResolvedValue({
      food: { id: 'food-1', name: 'Paneer' },
      removedMealPlanItems: 2,
      affectedActiveUserIds: ['user-a'],
    });

    const result = await service.remove('admin-1', 'admin', 'food-1');

    expect(result).toEqual({
      id: 'food-1',
      name: 'Paneer',
      deleted: true,
      removedMealPlanItems: 2,
      mealPlansQueuedForRebuild: 1,
    });
    expect(mealPlansService.rebuildActiveFromAvailableFoods).toHaveBeenCalledWith(
      'user-a',
    );
  });
});
