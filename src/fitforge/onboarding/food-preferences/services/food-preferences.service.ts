import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BulkFoodPreferencesDto } from '../dto/bulk-food-preferences.dto';
import { CreateFoodPreferenceDto } from '../dto/create-food-preference.dto';

@Injectable()
export class FoodPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, dto: CreateFoodPreferenceDto) {
    await this.ensureFood(dto.foodId);
    return this.prisma.userFoodPreference.upsert({
      where: {
        userId_foodId_preferenceType: {
          userId,
          foodId: dto.foodId,
          preferenceType: dto.preferenceType,
        },
      },
      create: { userId, ...dto },
      update: {},
      include: { food: true },
    });
  }

  async findAll(userId: string) {
    return this.prisma.userFoodPreference.findMany({
      where: { userId },
      include: { food: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const pref = await this.prisma.userFoodPreference.findFirst({
      where: { id, userId },
    });
    if (!pref) {
      throw new NotFoundException('Food preference not found');
    }
    await this.prisma.userFoodPreference.delete({ where: { id } });
    return { id };
  }

  async bulkSave(userId: string, dto: BulkFoodPreferencesDto) {
    const foodIds = [...dto.favorites, ...dto.restricted, ...dto.allergies];
    await this.ensureFoods(foodIds);

    await this.prisma.userFoodPreference.deleteMany({ where: { userId } });

    const rows = [
      ...dto.favorites.map((foodId) => ({
        userId,
        foodId,
        preferenceType: 'favorite',
      })),
      ...dto.restricted.map((foodId) => ({
        userId,
        foodId,
        preferenceType: 'restricted',
      })),
      ...dto.allergies.map((foodId) => ({
        userId,
        foodId,
        preferenceType: 'allergy',
      })),
    ];

    if (rows.length > 0) {
      await this.prisma.userFoodPreference.createMany({ data: rows });
    }

    return this.findAll(userId);
  }

  private async ensureFood(foodId: string) {
    const food = await this.prisma.foodMaster.findUnique({ where: { id: foodId } });
    if (!food) {
      throw new NotFoundException('Food not found');
    }
  }

  private async ensureFoods(foodIds: string[]) {
    const unique = [...new Set(foodIds)];
    if (unique.length === 0) {
      return;
    }
    const count = await this.prisma.foodMaster.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new NotFoundException('One or more foods not found');
    }
  }
}
