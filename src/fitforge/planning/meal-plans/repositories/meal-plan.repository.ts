import { Injectable } from '@nestjs/common';
import type { MealPlan, MealPlanItem, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

const itemInclude = {
  food: true,
} as const;

const planWithItemsInclude = {
  items: {
    include: itemInclude,
    orderBy: [{ dayNumber: 'asc' as const }, { mealType: 'asc' as const }],
  },
};

@Injectable()
export class MealPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, userId: string) {
    return this.prisma.mealPlan.findFirst({
      where: { id, userId },
      include: planWithItemsInclude,
    });
  }

  findActive(userId: string) {
    return this.prisma.mealPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: planWithItemsInclude,
    });
  }

  findHistory(userId: string, skip: number, take: number) {
    return Promise.all([
      this.prisma.mealPlan.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mealPlan.count({ where: { userId } }),
    ]);
  }

  latestVersion(userId: string, planType: string) {
    return this.prisma.mealPlan.findFirst({
      where: { userId, planType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
  }

  async createActiveWithItems(params: {
    userId: string;
    dietPlanId: string;
    version: number;
    planType: string;
    items: Array<{
      dayNumber: number;
      mealType: string;
      foodId: string;
      quantity: number;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.updateMany({
        where: { userId: params.userId, status: 'active' },
        data: { status: 'archived', endDate: new Date() },
      });

      return tx.mealPlan.create({
        data: {
          userId: params.userId,
          dietPlanId: params.dietPlanId,
          version: params.version,
          planType: params.planType,
          status: 'active',
          startDate: new Date(),
          items: {
            create: params.items.map((item) => ({
              dayNumber: item.dayNumber,
              mealType: item.mealType,
              foodId: item.foodId,
              quantity: item.quantity,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fats: item.fats,
            })),
          },
        },
        include: planWithItemsInclude,
      });
    });
  }

  createDraft(data: Prisma.MealPlanCreateInput) {
    return this.prisma.mealPlan.create({ data });
  }

  activate(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.mealPlan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived', endDate: new Date() },
      });
      return tx.mealPlan.update({
        where: { id },
        data: { status: 'active', startDate: new Date() },
        include: planWithItemsInclude,
      });
    });
  }
}
