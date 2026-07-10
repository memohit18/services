import { Injectable, NotFoundException } from '@nestjs/common';
import type { FoodMaster, MealPlan } from '@prisma/client';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MealPlansService } from '../../meal-plans/services/meal-plans.service';

export type GroceryItem = {
  foodId: string;
  name: string;
  quantity: number;
  unit: string;
  imageUrl: string | null;
};

const FOODS_IMAGE_BASE =
  process.env.FOODS_IMAGE_BASE ?? 'https://cdn.fitforge.app/foods';

export function resolveFoodImageUrl(
  food: Pick<FoodMaster, 'id' | 'name' | 'imageUrl'>,
): string | null {
  if (food.imageUrl) {
    return food.imageUrl;
  }
  if (!FOODS_IMAGE_BASE) {
    return null;
  }
  const slug = food.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `${FOODS_IMAGE_BASE}/${slug}.jpg` : null;
}

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
    const groceryItems = await this.buildItemsForMealPlan(plan.id);
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
    return { ...list, items: JSON.parse(list.itemsJson) as GroceryItem[] };
  }

  /**
   * For diet planner: prefer latest saved list for the active meal plan,
   * otherwise build a live aggregate from meal plan items.
   */
  async getForPlanner(userId: string, mealPlanId: string | null) {
    if (!mealPlanId) {
      return null;
    }

    const saved = await this.prisma.groceryList.findFirst({
      where: { userId, mealPlanId },
      orderBy: { createdAt: 'desc' },
    });

    const items = saved
      ? (JSON.parse(saved.itemsJson) as GroceryItem[]).map((item) => ({
          ...item,
          imageUrl: item.imageUrl ?? null,
        }))
      : await this.buildItemsForMealPlan(mealPlanId);

    // Backfill imageUrl for older saved lists
    if (saved && items.some((i) => !i.imageUrl)) {
      const foods = await this.prisma.foodMaster.findMany({
        where: { id: { in: items.map((i) => i.foodId) } },
        select: { id: true, name: true, imageUrl: true },
      });
      const byId = new Map(foods.map((f) => [f.id, f]));
      for (const item of items) {
        if (!item.imageUrl) {
          const food = byId.get(item.foodId);
          item.imageUrl = food ? resolveFoodImageUrl(food) : null;
        }
      }
    }

    return {
      id: saved?.id ?? null,
      mealPlanId,
      itemCount: items.length,
      items: items.slice(0, 40),
      persisted: saved != null,
      generateUrl: '/grocery/generate',
      currentUrl: '/grocery/current',
    };
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

  private async buildItemsForMealPlan(mealPlanId: string): Promise<GroceryItem[]> {
    const items = await this.prisma.mealPlanItem.findMany({
      where: { mealPlanId },
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
          imageUrl: resolveFoodImageUrl(item.food),
        });
      }
    }

    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
