import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FoodMaster } from '@prisma/client';
import { MEAL_LOG_STATUSES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  FitForgeCacheKeys,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { DailyAggregatorService } from '../../../tracking/checkins/services/daily-aggregator.service';
import { ReplaceMealDto } from '../dto/replace-meal.dto';
import { MealItemRepository } from '../repositories/meal-item.repository';
import { MealLogRepository } from '../repositories/meal-log.repository';
import { MealPlanRepository } from '../repositories/meal-plan.repository';

function startOfUtcDay(date: Date | string = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function resolveDayNumber(
  mealPlan: { startDate: Date | string | null; items: { dayNumber: number }[] },
  date: Date,
) {
  const maxDay = mealPlan.items.reduce(
    (max, item) => Math.max(max, item.dayNumber),
    7,
  );
  if (mealPlan.startDate) {
    const startRaw =
      mealPlan.startDate instanceof Date
        ? mealPlan.startDate
        : new Date(mealPlan.startDate);
    const start = startOfUtcDay(startRaw);
    const diffDays = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
    return ((diffDays % maxDay) + maxDay) % maxDay + 1;
  }
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

@Injectable()
export class MealTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealPlanRepository: MealPlanRepository,
    private readonly mealItemRepository: MealItemRepository,
    private readonly mealLogRepository: MealLogRepository,
    private readonly redis: RedisService,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  async getToday(userId: string, dateInput?: string) {
    const date = dateInput
      ? startOfUtcDay(new Date(`${dateInput}T00:00:00.000Z`))
      : startOfUtcDay();
    const dayEnd = new Date(date);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const plan = await this.mealPlanRepository.findActive(userId);
    if (!plan) {
      throw new NotFoundException('No active meal plan');
    }

    const dayNumber = resolveDayNumber(plan, date);
    const items = plan.items.filter((item) => item.dayNumber === dayNumber);
    const logs = await this.mealLogRepository.findTodayForItems(
      userId,
      items.map((i) => i.id),
      date,
      dayEnd,
    );
    const logByItem = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (log.mealPlanItemId && !logByItem.has(log.mealPlanItemId)) {
        logByItem.set(log.mealPlanItemId, log);
      }
    }

    return {
      date: date.toISOString().slice(0, 10),
      dayNumber,
      mealPlanId: plan.id,
      meals: items.map((item) => {
        const log = logByItem.get(item.id);
        const logged =
          log?.status === 'completed' ||
          log?.status === 'replaced' ||
          log?.status === 'partial';
        const consumedQuantity = logged ? (log?.consumedQuantity ?? 1) : null;
        const scale = consumedQuantity ?? 1;
        return {
          id: item.id,
          mealType: item.mealType,
          foodId: item.foodId,
          foodName: item.food.name,
          quantity: item.quantity,
          servingSize: item.food.servingSize ?? null,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          status: log?.status ?? 'pending',
          consumedQuantity,
          actualCalories: logged
            ? (log?.actualCalories ?? Math.round(item.calories * scale))
            : null,
          actualProtein: logged
            ? (log?.actualProtein ??
              Math.round(item.protein * scale * 10) / 10)
            : null,
          logId: log?.id ?? null,
          replacementFoodId: log?.replacementFoodId ?? null,
          replacementFoodName: log?.replacementFood?.name ?? null,
          originalFoodName: log?.originalFood?.name ?? null,
        };
      }),
    };
  }

  async getNutritionSummary(userId: string, dateInput?: string) {
    const today = await this.getToday(userId, dateInput);
    const plan = await this.mealPlanRepository.findActive(userId);
    if (!plan) {
      throw new NotFoundException('No active meal plan');
    }

    const targets = await this.prisma.dietPlan.findUnique({
      where: { id: plan.dietPlanId },
      select: {
        caloriesTarget: true,
        proteinTarget: true,
        carbsTarget: true,
        fatsTarget: true,
      },
    });

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    let completed = 0;

    for (const meal of today.meals) {
      if (
        meal.status === 'completed' ||
        meal.status === 'replaced' ||
        meal.status === 'partial'
      ) {
        completed += 1;
        const scale = meal.consumedQuantity ?? 1;
        calories += meal.actualCalories ?? Math.round(meal.calories * scale);
        protein +=
          meal.actualProtein ?? Math.round(meal.protein * scale * 10) / 10;
        carbs += Math.round(meal.carbs * scale * 10) / 10;
        fats += Math.round(meal.fats * scale * 10) / 10;
      }
    }

    const calorieTarget = targets?.caloriesTarget ?? 0;
    const proteinTarget = targets?.proteinTarget ?? 0;

    return {
      date: today.date,
      dayNumber: today.dayNumber,
      calories,
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
      remainingCalories: Math.max(0, calorieTarget - calories),
      remainingProtein: Math.max(
        0,
        Math.round((proteinTarget - protein) * 10) / 10,
      ),
      calorieTarget,
      proteinTarget,
      carbsTarget: targets?.carbsTarget ?? null,
      fatsTarget: targets?.fatsTarget ?? null,
      mealCompletionPercent:
        today.meals.length === 0
          ? 0
          : Math.round((completed / today.meals.length) * 100),
      mealsTotal: today.meals.length,
      mealsCompleted: completed,
    };
  }

  /**
   * Add an off-plan meal the user already ate: create today's plan item with
   * macros scaled by quantity, then mark it completed (consumedQuantity = 1
   * so calories are not scaled twice).
   */
  async logEaten(
    userId: string,
    opts: {
      foodId: string;
      mealType: string;
      quantity: number;
      notes?: string;
    },
  ) {
    const quantity = Math.round(opts.quantity * 100) / 100;
    if (!(quantity >= 0.1)) {
      throw new BadRequestException('quantity must be at least 0.1');
    }

    const plan = await this.mealPlanRepository.findActive(userId);
    if (!plan) {
      throw new NotFoundException('No active meal plan');
    }

    const food = await this.prisma.foodMaster.findUnique({
      where: { id: opts.foodId },
    });
    if (!food) {
      throw new NotFoundException('Food not found');
    }

    const date = startOfUtcDay();
    const dayNumber = resolveDayNumber(plan, date);
    const calories = Math.round(food.calories * quantity);
    const protein = Math.round(food.protein * quantity * 10) / 10;
    const carbs = Math.round(food.carbs * quantity * 10) / 10;
    const fats = Math.round(food.fats * quantity * 10) / 10;

    const item = await this.mealItemRepository.create({
      mealPlan: { connect: { id: plan.id } },
      food: { connect: { id: food.id } },
      dayNumber,
      mealType: opts.mealType,
      quantity,
      calories,
      protein,
      carbs,
      fats,
    });
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));

    // Item macros already include quantity; complete at 1 so nutrition summary
    // does not scale carbs/fats again via consumedQuantity.
    return this.complete(userId, item.id, {
      consumedQuantity: 1,
      notes: opts.notes,
    });
  }

  async complete(
    userId: string,
    mealItemId: string,
    opts?: { consumedQuantity?: number; notes?: string },
  ) {
    const qty = opts?.consumedQuantity ?? 1;
    return this.setStatus(userId, mealItemId, 'completed', {
      consumedQuantity: qty,
      notes: opts?.notes,
      scale: qty,
    });
  }

  async partial(
    userId: string,
    mealItemId: string,
    opts: { consumedQuantity: number; notes?: string },
  ) {
    if (opts.consumedQuantity <= 0 || opts.consumedQuantity >= 1) {
      throw new BadRequestException(
        'consumedQuantity for partial must be between 0 and 1 (exclusive of 0 and 1)',
      );
    }
    return this.setStatus(userId, mealItemId, 'partial', {
      consumedQuantity: opts.consumedQuantity,
      notes: opts.notes,
      scale: opts.consumedQuantity,
    });
  }

  async skip(userId: string, mealItemId: string, notes?: string) {
    return this.setStatus(userId, mealItemId, 'skipped', {
      consumedQuantity: 0,
      notes,
      scale: 0,
    });
  }

  async undo(userId: string, mealItemId: string) {
    const item = await this.mealItemRepository.findByIdForUser(
      mealItemId,
      userId,
    );
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }

    const { dayStart, dayEnd } = this.todayBounds();
    const existing = await this.mealLogRepository.findLatestForItemOnDay(
      userId,
      mealItemId,
      dayStart,
      dayEnd,
    );
    if (!existing) {
      throw new NotFoundException('No meal log to undo');
    }

    await this.mealLogRepository.deleteTodayForItem(
      userId,
      mealItemId,
      dayStart,
      dayEnd,
    );
    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    await this.dailyAggregator.rebuildForDate(userId, dayStart);

    return {
      mealPlanItemId: mealItemId,
      status: 'pending',
    };
  }

  async replace(userId: string, mealItemId: string, dto: ReplaceMealDto) {
    const item = await this.mealItemRepository.findByIdForUser(
      mealItemId,
      userId,
    );
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }

    const replacement = await this.prisma.foodMaster.findUnique({
      where: { id: dto.foodId },
    });
    if (!replacement) {
      throw new NotFoundException('Replacement food not found');
    }

    const quantity = dto.quantity ?? 1;
    this.assertMacroCompatible(item, replacement, quantity);

    const calories = Math.round(replacement.calories * quantity);
    const protein = Math.round(replacement.protein * quantity * 10) / 10;
    const carbs = Math.round(replacement.carbs * quantity * 10) / 10;
    const fats = Math.round(replacement.fats * quantity * 10) / 10;

    await this.mealItemRepository.update(mealItemId, {
      food: { connect: { id: replacement.id } },
      quantity,
      calories,
      protein,
      carbs,
      fats,
    });

    const { dayStart, dayEnd } = this.todayBounds();
    const log = await this.mealLogRepository.upsertTodayStatus({
      userId,
      mealPlanItemId: mealItemId,
      status: 'replaced',
      originalFoodId: item.foodId,
      replacementFoodId: replacement.id,
      actualCalories: calories,
      actualProtein: protein,
      consumedQuantity: 1,
      dayStart,
      dayEnd,
    });

    await this.redis.del(FitForgeCacheKeys.activeMealPlan(userId));
    await this.dailyAggregator.rebuildForDate(userId, dayStart);
    return log;
  }

  private async setStatus(
    userId: string,
    mealItemId: string,
    status: (typeof MEAL_LOG_STATUSES)[number],
    opts: {
      consumedQuantity?: number;
      notes?: string;
      scale: number;
    },
  ) {
    const item = await this.mealItemRepository.findByIdForUser(
      mealItemId,
      userId,
    );
    if (!item) {
      throw new NotFoundException('Meal plan item not found');
    }

    const { dayStart, dayEnd } = this.todayBounds();
    const scale = opts.scale;
    const log = await this.mealLogRepository.upsertTodayStatus({
      userId,
      mealPlanItemId: mealItemId,
      status,
      originalFoodId: item.foodId,
      actualCalories:
        status === 'skipped' ? 0 : Math.round(item.calories * scale),
      actualProtein:
        status === 'skipped'
          ? 0
          : Math.round(item.protein * scale * 10) / 10,
      consumedQuantity: opts.consumedQuantity ?? null,
      notes: opts.notes ?? null,
      dayStart,
      dayEnd,
    });
    await this.dailyAggregator.rebuildForDate(userId, dayStart);
    return log;
  }

  private assertMacroCompatible(
    item: { calories: number; protein: number },
    food: FoodMaster,
    quantity: number,
  ) {
    const calories = food.calories * quantity;
    const protein = food.protein * quantity;
    const calorieDrift =
      item.calories === 0
        ? 0
        : Math.abs(calories - item.calories) / item.calories;
    const proteinDrift =
      item.protein === 0 ? 0 : Math.abs(protein - item.protein) / item.protein;

    if (calorieDrift > 0.1 || proteinDrift > 0.1) {
      throw new BadRequestException(
        'Replacement food macros differ too much from the original meal (calories/protein must stay within ±10%)',
      );
    }
  }

  private todayBounds() {
    const dayStart = startOfUtcDay();
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    return { dayStart, dayEnd };
  }
}
