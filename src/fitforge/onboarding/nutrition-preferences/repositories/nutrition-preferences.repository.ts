import { Injectable } from '@nestjs/common';
import type { Prisma, UserNutritionPreference } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

export type NutritionPreferencesCreateInput = Pick<
  Prisma.UserNutritionPreferenceUncheckedCreateInput,
  | 'budgetCategory'
  | 'preferredCuisine'
  | 'mealsPerDay'
  | 'cookingTimeMinutes'
  | 'preferredMealTiming'
>;

export type NutritionPreferencesUpdateInput = Partial<
  Pick<
    Prisma.UserNutritionPreferenceUncheckedUpdateInput,
    | 'budgetCategory'
    | 'preferredCuisine'
    | 'mealsPerDay'
    | 'cookingTimeMinutes'
    | 'preferredMealTiming'
  >
>;

@Injectable()
export class NutritionPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    data: NutritionPreferencesCreateInput,
  ): Promise<UserNutritionPreference> {
    return this.prisma.userNutritionPreference.create({
      data: { userId, ...data },
    });
  }

  async update(
    userId: string,
    data: NutritionPreferencesUpdateInput,
  ): Promise<UserNutritionPreference> {
    return this.prisma.userNutritionPreference.update({
      where: { userId },
      data,
    });
  }

  async findByUserId(userId: string): Promise<UserNutritionPreference | null> {
    return this.prisma.userNutritionPreference.findUnique({ where: { userId } });
  }

  async exists(userId: string): Promise<boolean> {
    const count = await this.prisma.userNutritionPreference.count({ where: { userId } });
    return count > 0;
  }

  async delete(userId: string): Promise<UserNutritionPreference> {
    return this.prisma.userNutritionPreference.delete({ where: { userId } });
  }
}
