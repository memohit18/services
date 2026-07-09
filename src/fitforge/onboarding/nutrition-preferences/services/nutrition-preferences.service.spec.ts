import { ConflictException, NotFoundException } from '@nestjs/common';
import { NutritionPreferencesService } from './nutrition-preferences.service';

describe('NutritionPreferencesService', () => {
  const repository = {
    findByUserId: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const service = new NutritionPreferencesService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new record when one does not exist', async () => {
    repository.exists.mockResolvedValue(false);
    repository.create.mockResolvedValue({
      id: '1',
      userId: 'u1',
      budgetCategory: 'moderate',
      preferredCuisine: 'indian',
      mealsPerDay: 4,
      cookingTimeMinutes: 30,
      preferredMealTiming: 'flexible',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create('u1', {
      budgetCategory: 'moderate',
      preferredCuisine: 'indian',
      mealsPerDay: 4,
      cookingTimeMinutes: 30,
      preferredMealTiming: 'flexible',
    });

    expect(result.userId).toBe('u1');
    expect(repository.create).toHaveBeenCalled();
  });

  it('rejects duplicate nutrition preferences', async () => {
    repository.exists.mockResolvedValue(true);

    await expect(
      service.create('u1', {
        budgetCategory: 'moderate',
        preferredCuisine: 'indian',
        mealsPerDay: 4,
        cookingTimeMinutes: 30,
        preferredMealTiming: 'flexible',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects update when record is missing', async () => {
    repository.exists.mockResolvedValue(false);

    await expect(service.update('u1', { mealsPerDay: 5 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
