import { Injectable } from '@nestjs/common';
import type { FoodMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface FoodSearchParams {
  userId: string;
  skip: number;
  take: number;
  category?: string;
  dietType?: string;
  search?: string;
}

@Injectable()
export class FoodsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FoodSearchParams): Promise<{ items: FoodMaster[]; total: number }> {
    return this.search(params);
  }

  async search(params: FoodSearchParams): Promise<{ items: FoodMaster[]; total: number }> {
    const where = this.buildWhere(params);
    const [items, total] = await Promise.all([
      this.prisma.foodMaster.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.foodMaster.count({ where }),
    ]);
    return { items, total };
  }

  async categories(): Promise<Array<{ id: string; label: string; count: number }>> {
    const rows = await this.prisma.foodMaster.groupBy({
      by: ['category'],
      where: { isVerified: true, category: { not: null } },
      _count: { category: true },
      orderBy: { category: 'asc' },
    });

    return rows
      .filter((row): row is typeof row & { category: string } => row.category !== null)
      .map((row) => ({
        id: row.category,
        label: row.category,
        count: row._count.category,
      }));
  }

  async findById(id: string): Promise<FoodMaster | null> {
    return this.prisma.foodMaster.findUnique({ where: { id } });
  }

  async findAccessibleById(id: string, userId: string): Promise<FoodMaster | null> {
    return this.prisma.foodMaster.findFirst({
      where: {
        id,
        OR: [{ isVerified: true }, { isCustom: true, createdByUserId: userId }],
      },
    });
  }

  async create(data: Prisma.FoodMasterCreateInput): Promise<FoodMaster> {
    return this.prisma.foodMaster.create({ data });
  }

  async update(id: string, data: Prisma.FoodMasterUpdateInput): Promise<FoodMaster> {
    return this.prisma.foodMaster.update({ where: { id }, data });
  }

  async countMealPlanUsages(foodId: string): Promise<number> {
    return this.prisma.mealPlanItem.count({ where: { foodId } });
  }

  /**
   * Deletes food + preferences + meal plan items referencing it.
   * Returns userIds whose active meal plans were affected (rebuild those).
   */
  async delete(id: string): Promise<{
    food: FoodMaster;
    removedMealPlanItems: number;
    affectedActiveUserIds: string[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.mealPlanItem.findMany({
        where: { foodId: id },
        select: {
          id: true,
          mealPlan: { select: { userId: true, status: true } },
        },
      });

      const removedMealPlanItems = items.length;
      const affectedActiveUserIds = [
        ...new Set(
          items
            .filter((i) => i.mealPlan.status === 'active')
            .map((i) => i.mealPlan.userId),
        ),
      ];

      if (removedMealPlanItems > 0) {
        // Detach logs so meal_plan_items can be removed (FK SetNull is on delete)
        await tx.mealLog.updateMany({
          where: { mealPlanItemId: { in: items.map((i) => i.id) } },
          data: { mealPlanItemId: null },
        });
        await tx.mealPlanItem.deleteMany({ where: { foodId: id } });
      }

      await tx.userFoodPreference.deleteMany({ where: { foodId: id } });
      const food = await tx.foodMaster.delete({ where: { id } });

      return { food, removedMealPlanItems, affectedActiveUserIds };
    });
  }

  async countByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return this.prisma.foodMaster.count({ where: { id: { in: ids } } });
  }

  private buildWhere(params: FoodSearchParams): Prisma.FoodMasterWhereInput {
    const where: Prisma.FoodMasterWhereInput = {
      OR: [{ isVerified: true }, { isCustom: true, createdByUserId: params.userId }],
    };

    if (params.category) {
      where.category = { equals: params.category, mode: 'insensitive' };
    }
    if (params.dietType) {
      where.dietType = params.dietType;
    }
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    return where;
  }
}
