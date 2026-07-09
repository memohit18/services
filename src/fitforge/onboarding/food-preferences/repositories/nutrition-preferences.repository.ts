import { Injectable } from '@nestjs/common';
import type { UserNutritionPreference } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface NutritionPreferenceInput {
  budgetCategory?: string | null;
  preferredCuisine?: string | null;
  mealCount?: number | null;
  cookingTime?: string | null;
}

@Injectable()
export class NutritionPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserNutritionPreference | null> {
    return this.prisma.userNutritionPreference.findUnique({ where: { userId } });
  }

  async save(
    userId: string,
    data: NutritionPreferenceInput,
  ): Promise<UserNutritionPreference> {
    return this.prisma.userNutritionPreference.create({
      data: { userId, ...data },
    });
  }

  async update(
    userId: string,
    data: NutritionPreferenceInput,
  ): Promise<UserNutritionPreference> {
    return this.prisma.userNutritionPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
