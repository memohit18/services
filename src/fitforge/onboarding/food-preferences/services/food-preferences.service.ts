import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FoodPreferenceType } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { CreateFoodPreferenceDto } from '../dto/create-food-preference.dto';
import { PatchFoodPreferencesDto } from '../dto/patch-food-preferences.dto';
import { FoodPreferencesRepository } from '../repositories/food-preferences.repository';
import { NutritionPreferencesRepository } from '../repositories/nutrition-preferences.repository';
import {
  assertNoDuplicateFoodIds,
  flattenPreferenceGroups,
  groupPreferences,
} from '../utils/food-preferences.util';
import { FoodsRepository } from '../../foods/repositories/foods.repository';

@Injectable()
export class FoodPreferencesService {
  constructor(
    private readonly foodPreferencesRepository: FoodPreferencesRepository,
    private readonly nutritionPreferencesRepository: NutritionPreferencesRepository,
    private readonly foodsRepository: FoodsRepository,
  ) {}

  async getPreferences(userId: string) {
    const [preferences, nutrition] = await Promise.all([
      this.foodPreferencesRepository.getPreferences(userId),
      this.nutritionPreferencesRepository.get(userId),
    ]);
    const grouped = groupPreferences(preferences);
    return {
      favorites: grouped.favorite,
      available: grouped.available,
      restricted: grouped.restricted,
      allergies: grouped.allergy,
      nutrition,
    };
  }

  async add(userId: string, dto: CreateFoodPreferenceDto) {
    await this.ensureFood(dto.foodId);
    const pref = await this.foodPreferencesRepository.upsertPreference(
      userId,
      dto.foodId,
      dto.preferenceType as FoodPreferenceType,
    );
    return pref;
  }

  async replace(userId: string, dto: PatchFoodPreferencesDto) {
    const groups = {
      favorites: dto.favorites,
      available: dto.available,
      restricted: dto.restricted,
      allergies: dto.allergies,
    };
    assertNoDuplicateFoodIds(groups);

    const foodIds = [
      ...dto.favorites,
      ...dto.available,
      ...dto.restricted,
      ...dto.allergies,
    ];
    await this.ensureFoods(foodIds);

    const rows = flattenPreferenceGroups(groups);
    const preferences = await this.foodPreferencesRepository.replacePreferences(
      userId,
      rows,
    );

    let nutrition = await this.nutritionPreferencesRepository.get(userId);
    if (dto.nutrition) {
      nutrition = await this.nutritionPreferencesRepository.update(
        userId,
        dto.nutrition,
      );
    }

    const grouped = groupPreferences(preferences);
    return {
      favorites: grouped.favorite,
      available: grouped.available,
      restricted: grouped.restricted,
      allergies: grouped.allergy,
      nutrition,
    };
  }

  async removeByFoodId(userId: string, foodId: string) {
    const removed = await this.foodPreferencesRepository.removePreference(
      userId,
      foodId,
    );
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
