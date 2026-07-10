import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class MealLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTodayForItems(userId: string, itemIds: string[], dayStart: Date, dayEnd: Date) {
    if (itemIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.mealLog.findMany({
      where: {
        userId,
        mealPlanItemId: { in: itemIds },
        consumedAt: { gte: dayStart, lt: dayEnd },
      },
      include: {
        replacementFood: true,
        originalFood: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findLatestForItemOnDay(
    userId: string,
    mealPlanItemId: string,
    dayStart: Date,
    dayEnd: Date,
  ) {
    return this.prisma.mealLog.findFirst({
      where: {
        userId,
        mealPlanItemId,
        consumedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Prisma.MealLogCreateInput) {
    return this.prisma.mealLog.create({
      data,
      include: {
        mealPlanItem: { include: { food: true } },
        replacementFood: true,
        originalFood: true,
      },
    });
  }

  upsertTodayStatus(params: {
    userId: string;
    mealPlanItemId: string;
    status: string;
    originalFoodId: string;
    replacementFoodId?: string | null;
    actualCalories?: number | null;
    actualProtein?: number | null;
    dayStart: Date;
    dayEnd: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.mealLog.findFirst({
        where: {
          userId: params.userId,
          mealPlanItemId: params.mealPlanItemId,
          consumedAt: { gte: params.dayStart, lt: params.dayEnd },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return tx.mealLog.update({
          where: { id: existing.id },
          data: {
            status: params.status,
            originalFoodId: params.originalFoodId,
            replacementFoodId: params.replacementFoodId ?? null,
            actualCalories: params.actualCalories ?? null,
            actualProtein: params.actualProtein ?? null,
            consumedAt: new Date(),
          },
          include: {
            mealPlanItem: { include: { food: true } },
            replacementFood: true,
            originalFood: true,
          },
        });
      }

      return tx.mealLog.create({
        data: {
          userId: params.userId,
          mealPlanItemId: params.mealPlanItemId,
          status: params.status,
          originalFoodId: params.originalFoodId,
          replacementFoodId: params.replacementFoodId ?? null,
          actualCalories: params.actualCalories ?? null,
          actualProtein: params.actualProtein ?? null,
          consumedAt: new Date(),
        },
        include: {
          mealPlanItem: { include: { food: true } },
          replacementFood: true,
          originalFood: true,
        },
      });
    });
  }
}
