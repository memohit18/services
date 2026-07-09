import { Injectable, NotFoundException } from '@nestjs/common';
import type { FoodPreferenceType } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { FoodsRepository } from '../../foods/repositories/foods.repository';
import { CreateFoodPreferenceDto } from '../dto/create-food-preference.dto';
import { PatchFoodPreferencesDto } from '../dto/patch-food-preferences.dto';
import { FoodPreferencesRepository } from '../repositories/food-preferences.repository';
import {
  assertNoDuplicateFoodIds,
  flattenPreferenceGroups,
  groupPreferences,
} from '../utils/food-preferences.util';

@Injectable()
export class FoodPreferencesService {
  constructor(
    private readonly foodPreferencesRepository: FoodPreferencesRepository,
    private readonly foodsRepository: FoodsRepository,
  ) {}

  async getPreferences(userId: string) {
    const preferences = await this.foodPreferencesRepository.getPreferences(userId);
    const grouped = groupPreferences(preferences);
    return {
      favorites: grouped.favorite,
      available: grouped.available,
      restricted: grouped.restricted,
    };
  }

  async add(userId: string, dto: CreateFoodPreferenceDto) {
    await this.ensureFood(dto.foodId);
    return this.foodPreferencesRepository.upsertPreference(
      userId,
      dto.foodId,
      dto.preferenceType as FoodPreferenceType,
    );
  }

  async replace(userId: string, dto: PatchFoodPreferencesDto) {
    const groups = {
      favorites: dto.favorites,
      available: dto.available,
      restricted: dto.restricted,
    };
    assertNoDuplicateFoodIds(groups);

    const foodIds = [...dto.favorites, ...dto.available, ...dto.restricted];
    await this.ensureFoods(foodIds);

    const preferences = await this.foodPreferencesRepository.replacePreferences(
      userId,
      flattenPreferenceGroups(groups),
    );
    const grouped = groupPreferences(preferences);

    return {
      favorites: grouped.favorite,
      available: grouped.available,
      restricted: grouped.restricted,
    };
  }

  async removeByFoodId(userId: string, foodId: string) {
    const removed = await this.foodPreferencesRepository.removePreference(userId, foodId);
    if (!removed) {
      throw new NotFoundException('Food preference not found');
    }
    return { foodId };
  }

  private async ensureFood(foodId: string) {
    const food = await this.foodsRepository.findById(foodId);
    if (!food) {
      throw new NotFoundException('Food not found');
    }
  }

  private async ensureFoods(foodIds: string[]) {
    const unique = [...new Set(foodIds)];
    if (unique.length === 0) {
      return;
    }
    const count = await this.foodsRepository.countByIds(unique);
    if (count !== unique.length) {
      throw new NotFoundException('One or more foods not found');
    }
  }
}
