import { BadRequestException } from '@nestjs/common';
import type { FoodPreferenceType } from '../../../../../db-schema/postgres/constants/fitforge-values';

export interface PreferenceGroups {
  favorites: string[];
  available: string[];
  restricted: string[];
  allergies: string[];
}

export function assertNoDuplicateFoodIds(groups: PreferenceGroups): void {
  const seen = new Map<string, FoodPreferenceType>();
  const entries: Array<[FoodPreferenceType, string[]]> = [
    ['favorite', groups.favorites],
    ['available', groups.available],
    ['restricted', groups.restricted],
    ['allergy', groups.allergies],
  ];

  for (const [type, foodIds] of entries) {
    for (const foodId of foodIds) {
      const existing = seen.get(foodId);
      if (existing) {
        throw new BadRequestException(
          `Food ${foodId} cannot appear in multiple preference groups (${existing} and ${type})`,
        );
      }
      seen.set(foodId, type);
    }
  }
}

export function flattenPreferenceGroups(groups: PreferenceGroups): Array<{
  foodId: string;
  preferenceType: FoodPreferenceType;
}> {
  return [
    ...groups.favorites.map((foodId) => ({
      foodId,
      preferenceType: 'favorite' as const,
    })),
    ...groups.available.map((foodId) => ({
      foodId,
      preferenceType: 'available' as const,
    })),
    ...groups.restricted.map((foodId) => ({
      foodId,
      preferenceType: 'restricted' as const,
    })),
    ...groups.allergies.map((foodId) => ({
      foodId,
      preferenceType: 'allergy' as const,
    })),
  ];
}

export function groupPreferences<
  T extends { foodId: string; preferenceType: string; food: unknown },
>(preferences: T[]): Record<FoodPreferenceType, T[]> {
  return {
    favorite: preferences.filter((p) => p.preferenceType === 'favorite'),
    available: preferences.filter((p) => p.preferenceType === 'available'),
    restricted: preferences.filter((p) => p.preferenceType === 'restricted'),
    allergy: preferences.filter((p) => p.preferenceType === 'allergy'),
  };
}
