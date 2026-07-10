import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class MealItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdForUser(itemId: string, userId: string) {
    return this.prisma.mealPlanItem.findFirst({
      where: { id: itemId, mealPlan: { userId } },
      include: {
        food: true,
        mealPlan: true,
      },
    });
  }

  findByPlanAndDay(mealPlanId: string, dayNumber: number) {
    return this.prisma.mealPlanItem.findMany({
      where: { mealPlanId, dayNumber },
      include: { food: true },
      orderBy: { mealType: 'asc' },
    });
  }

  create(data: Prisma.MealPlanItemCreateInput) {
    return this.prisma.mealPlanItem.create({
      data,
      include: { food: true },
    });
  }

  update(id: string, data: Prisma.MealPlanItemUpdateInput) {
    return this.prisma.mealPlanItem.update({
      where: { id },
      data,
      include: { food: true },
    });
  }

  delete(id: string) {
    return this.prisma.mealPlanItem.delete({ where: { id } });
  }
}
