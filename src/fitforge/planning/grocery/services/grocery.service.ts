import { Injectable, NotFoundException } from '@nestjs/common';
import type { MealPlan } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MealPlansService } from '../../meal-plans/services/meal-plans.service';

type GroceryItem = {
  foodId: string;
  name: string;
  quantity: number;
  unit: string;
};

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealPlansService: MealPlansService,
  ) {}

  async generate(userId: string) {
    const plan = (await this.mealPlansService.getActive(userId)) as MealPlan & {
      id: string;
    };
    const items = await this.prisma.mealPlanItem.findMany({
      where: { mealPlanId: plan.id },
      include: { food: true },
    });

    const grouped = new Map<string, GroceryItem>();
    for (const item of items) {
      const key = item.foodId;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        grouped.set(key, {
          foodId: item.foodId,
          name: item.food.name,
          quantity: item.quantity,
          unit: item.food.servingSize ?? 'serving',
        });
      }
    }

    const groceryItems = [...grouped.values()];
    const list = await this.prisma.groceryList.create({
      data: {
        userId,
        mealPlanId: plan.id,
        itemsJson: JSON.stringify(groceryItems),
      },
    });

    return { ...list, items: groceryItems };
  }

  async getCurrent(userId: string) {
    const list = await this.prisma.groceryList.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!list) {
      throw new NotFoundException('No grocery list found');
    }
    return { ...list, items: JSON.parse(list.itemsJson) };
  }

  async getHistory(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.groceryList.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.groceryList.count({ where }),
    ]);

    const items = rows.map((row) => ({
      ...row,
      items: JSON.parse(row.itemsJson),
    }));

    return paginatedResponse(items, total, page, limit);
  }
}
