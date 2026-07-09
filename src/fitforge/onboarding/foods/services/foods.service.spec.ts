import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FoodsService } from './foods.service';
import { FoodsRepository } from '../repositories/foods.repository';

describe('FoodsService', () => {
  const foodsRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  } as unknown as FoodsRepository;

  const service = new FoodsService(foodsRepository);

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

    expect(foodsRepository.update).toHaveBeenCalledWith('food-1', { category: 'grain' });
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

    expect(foodsRepository.update).toHaveBeenCalledWith('food-1', { category: null });
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
});
