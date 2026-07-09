import { Injectable } from '@nestjs/common';
import type { Prisma, UserFoodPreference } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { FoodPreferenceType } from '../../../../../db-schema/postgres/constants/fitforge-values';

export type FoodPreferenceWithFood = Prisma.UserFoodPreferenceGetPayload<{
  include: { food: true };
}>;

export interface PreferenceRow {
  foodId: string;
  preferenceType: FoodPreferenceType;
}

@Injectable()
export class FoodPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<FoodPreferenceWithFood[]> {
    return this.prisma.userFoodPreference.findMany({
      where: { userId },
      include: { food: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replacePreferences(
    userId: string,
    rows: PreferenceRow[],
  ): Promise<FoodPreferenceWithFood[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userFoodPreference.deleteMany({ where: { userId } });
      if (rows.length > 0) {
        await tx.userFoodPreference.createMany({
          data: rows.map((row) => ({
            userId,
            foodId: row.foodId,
            preferenceType: row.preferenceType,
          })),
        });
      }
      return tx.userFoodPreference.findMany({
        where: { userId },
        include: { food: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async upsertPreference(
    userId: string,
    foodId: string,
    preferenceType: FoodPreferenceType,
  ): Promise<FoodPreferenceWithFood> {
    return this.prisma.userFoodPreference.upsert({
      where: { userId_foodId: { userId, foodId } },
      create: { userId, foodId, preferenceType },
      update: { preferenceType },
      include: { food: true },
    });
  }

  async removePreference(
    userId: string,
    foodId: string,
  ): Promise<UserFoodPreference | null> {
    const pref = await this.prisma.userFoodPreference.findFirst({
      where: { userId, foodId },
    });
    if (!pref) {
      return null;
    }
    await this.prisma.userFoodPreference.delete({ where: { id: pref.id } });
    return pref;
  }
}
