import { Injectable, NotFoundException } from '@nestjs/common';
import type { DailyCheckin, DietPlan, FoodMaster, MealPlanItem } from '@prisma/client';
import { MEAL_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HydrationService } from '../../../tracking/checkins/services/hydration.service';
import {
  GroceryService,
  resolveFoodImageUrl,
} from '../../grocery/services/grocery.service';
import { MealPlansService } from '../../meal-plans/services/meal-plans.service';
import { DietService } from './diet.service';

const MEAL_SCHEDULE: Record<string, string> = {
  breakfast: '07:30',
  lunch: '13:00',
  snack: '16:00',
  dinner: '20:00',
};

const MEAL_DISPLAY_NAMES: Record<string, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  snack: 'POST-WORKOUT',
  dinner: 'DINNER',
};

const GOAL_PHASE_LABELS: Record<string, string> = {
  muscle_gain: 'HYPERTROPHY FOCUS',
  fat_loss: 'FAT LOSS FOCUS',
  recomposition: 'RECOMPOSITION FOCUS',
  maintenance: 'MAINTENANCE',
};

const GOAL_STATUS_MESSAGES: Record<string, string> = {
  muscle_gain:
    'Current protocol prioritizes lean mass accumulation. AI is monitoring glycemic response and protein synthesis windows.',
  fat_loss:
    'Current protocol prioritizes sustainable fat loss while preserving muscle. AI is monitoring calorie deficit and adherence.',
  recomposition:
    'Current protocol balances fat loss and muscle gain. AI is monitoring body composition signals and recovery.',
  maintenance:
    'Current protocol maintains your physique. AI is monitoring consistency and macro balance.',
};

const HYDRATION_TARGET_ML = 4000;
const FIBER_TARGET_G = 30;

/** Categories used when looking for carb-side swaps (FoodMaster.category values). */
const SWAP_CARB_CATEGORIES = ['grain', 'vegetable', 'legume', 'staple', 'fruit'];

type MealItemWithFood = MealPlanItem & { food: FoodMaster };

@Injectable()
export class DietPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dietService: DietService,
    private readonly mealPlansService: MealPlansService,
    private readonly hydrationService: HydrationService,
    private readonly groceryService: GroceryService,
  ) {}

  async getDashboard(userId: string, dateInput?: string) {
    const date = dateInput ? parseDateOnly(dateInput) : startOfLocalDay(new Date());
    const dayEnd = new Date(date);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [dietPlan, mealPlan, profile, transformation, todayCheckin, hasWorkoutPlan] =
      await Promise.all([
        this.dietService.getActive(userId).catch(() => null),
        this.mealPlansService.getActive(userId).catch(() => null),
        this.prisma.userFitnessProfile.findUnique({ where: { userId } }),
        this.prisma.transformationTarget.findFirst({
          where: { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.dailyCheckin.findUnique({
          where: { userId_checkInDate: { userId, checkInDate: date } },
          select: {
            caloriesConsumed: true,
            proteinConsumed: true,
            waterIntakeMl: true,
          },
        }),
        this.prisma.workoutPlan
          .findFirst({
            where: { userId, status: 'active' },
            select: { id: true },
          })
          .then((plan) => plan != null),
      ]);

    if (!dietPlan) {
      throw new NotFoundException('No active diet plan. Generate targets first.');
    }

    const dayNumber = mealPlan ? resolveDayNumber(mealPlan, date) : 1;
    const todayItems = mealPlan
      ? mealPlan.items.filter((item) => item.dayNumber === dayNumber)
      : [];

    const mealLogs = todayItems.length
      ? await this.prisma.mealLog.findMany({
          where: {
            userId,
            mealPlanItemId: { in: todayItems.map((item) => item.id) },
            consumedAt: { gte: date, lt: dayEnd },
          },
          include: { mealPlanItem: true },
        })
      : [];

    const logsByItemId = new Map(mealLogs.map((log) => [log.mealPlanItemId!, log]));
    const meals = buildMealSlots(todayItems, logsByItemId, hasWorkoutPlan);

    const consumedFromMeals = sumConsumedMacros(meals);
    const caloriesConsumed =
      todayCheckin?.caloriesConsumed ?? consumedFromMeals.calories;
    const proteinConsumed =
      todayCheckin?.proteinConsumed ?? Math.round(consumedFromMeals.protein);

    const caloriesTarget = dietPlan.caloriesTarget ?? 0;
    const proteinTarget = dietPlan.proteinTarget ?? 0;

    const [swapSuggestion, groceryList] = await Promise.all([
      this.buildSwapSuggestion(meals, profile?.dietType),
      this.groceryService.getForPlanner(userId, mealPlan?.id ?? null),
    ]);

    const coachInsight = buildCoachInsight({
      meals,
      proteinTarget,
      proteinConsumed,
      caloriesTarget,
      caloriesConsumed,
    });

    return {
      date: date.toISOString().slice(0, 10),
      plan: {
        dietPlanId: dietPlan.id,
        mealPlanId: mealPlan?.id ?? null,
        version: dietPlan.version,
        label: `Diet Planner V${dietPlan.version}`,
        phase: buildPhaseLabel(dietPlan, profile?.fitnessGoal),
        statusMessage: buildStatusMessage(profile?.fitnessGoal),
        goal: dietPlan.goal ?? profile?.fitnessGoal ?? null,
      },
      targets: {
        calories: caloriesTarget,
        protein: proteinTarget,
        carbs: dietPlan.carbsTarget ?? 0,
        fats: dietPlan.fatsTarget ?? 0,
      },
      progress: {
        calories: {
          consumed: caloriesConsumed,
          remaining: Math.max(0, caloriesTarget - caloriesConsumed),
          percent: percentOf(caloriesConsumed, caloriesTarget),
        },
        protein: {
          consumed: proteinConsumed,
          remaining: Math.max(0, proteinTarget - proteinConsumed),
          percent: percentOf(proteinConsumed, proteinTarget),
        },
        mealsCompleted: meals.filter((m) => m.status === 'completed').length,
        mealsAssigned: meals.length,
        mealsSkipped: meals.filter((m) => m.status === 'skipped').length,
        dietCompliance: computeCompliance(meals),
      },
      meals,
      hydration: {
        currentMl: todayCheckin?.waterIntakeMl ?? 0,
        targetMl: HYDRATION_TARGET_ML,
        currentLiters: round1((todayCheckin?.waterIntakeMl ?? 0) / 1000),
        targetLiters: HYDRATION_TARGET_ML / 1000,
        percent: percentOf(todayCheckin?.waterIntakeMl ?? 0, HYDRATION_TARGET_ML),
        quickAddOptionsMl: [250, 500, 750, 1000],
      },
      vitals: buildVitals(consumedFromMeals, meals),
      coachInsight,
      swapSuggestion,
      groceryList,
      transformation: transformation
        ? {
            id: transformation.id,
            estimatedWeeks: transformation.estimatedWeeks,
            targetWeightKg: transformation.targetWeightKg,
            currentWeightKg: transformation.currentWeightKg,
          }
        : null,
      actions: {
        historyUrl: '/diet/history',
        editPlanUrl: `/diet/${dietPlan.id}`,
        checkinUrl: '/checkins',
        logMealUrl: '/meal-logs',
        groceryUrl: '/grocery/current',
        generateGroceryUrl: '/grocery/generate',
      },
    };
  }

  async addHydration(userId: string, amountMl: number) {
    const { checkin } = await this.hydrationService.log(userId, amountMl);
    return this.formatHydration(checkin);
  }

  private formatHydration(checkin: DailyCheckin) {
    const currentMl = checkin.waterIntakeMl ?? 0;
    return {
      currentMl,
      targetMl: HYDRATION_TARGET_ML,
      currentLiters: round1(currentMl / 1000),
      targetLiters: HYDRATION_TARGET_ML / 1000,
      percent: percentOf(currentMl, HYDRATION_TARGET_ML),
      quickAddOptionsMl: [250, 500, 750, 1000],
    };
  }

  private async buildSwapSuggestion(
    meals: ReturnType<typeof buildMealSlots>,
    dietType?: string | null,
  ) {
    const pendingItem = meals
      .filter((m) => m.status === 'pending' || m.status === 'partial')
      .flatMap((m) => m.items.filter((i) => i.logStatus === 'pending'))
      .sort((a, b) => b.carbs - a.carbs)[0];

    if (!pendingItem) {
      return null;
    }

    const dietFilter = dietType
      ? { OR: [{ dietType }, { dietType: null }] }
      : {};

    let alternatives = await this.prisma.foodMaster.findMany({
      where: {
        id: { not: pendingItem.foodId },
        isVerified: true,
        ...dietFilter,
        category: { in: SWAP_CARB_CATEGORIES },
        carbs: { lte: Math.max(pendingItem.carbs, 1) },
      },
      orderBy: [{ protein: 'desc' }, { carbs: 'asc' }],
      take: 12,
    });

    if (alternatives.length === 0) {
      alternatives = await this.prisma.foodMaster.findMany({
        where: {
          id: { not: pendingItem.foodId },
          isVerified: true,
          ...dietFilter,
          calories: {
            gte: Math.round(pendingItem.calories * 0.7),
            lte: Math.round(pendingItem.calories * 1.3),
          },
        },
        orderBy: { protein: 'desc' },
        take: 12,
      });
    }

    if (alternatives.length === 0) {
      alternatives = await this.prisma.foodMaster.findMany({
        where: {
          id: { not: pendingItem.foodId },
          isVerified: true,
          category: { in: [...SWAP_CARB_CATEGORIES, 'protein', 'dairy'] },
        },
        orderBy: { protein: 'desc' },
        take: 8,
      });
    }

    const suggestion =
      alternatives.find(
        (food) =>
          food.carbs <= pendingItem.carbs &&
          food.protein >= pendingItem.protein * 0.75,
      ) ??
      alternatives.find((food) => food.id !== pendingItem.foodId) ??
      null;

    if (!suggestion) {
      return null;
    }

    const carbDelta = round1(suggestion.carbs - pendingItem.carbs);
    const proteinDelta = round1(suggestion.protein - pendingItem.protein);

    return {
      mealPlanItemId: pendingItem.id,
      mealType: pendingItem.mealType,
      current: {
        foodId: pendingItem.foodId,
        name: pendingItem.foodName,
        quantity: pendingItem.quantity,
        carbs: pendingItem.carbs,
        protein: pendingItem.protein,
        calories: pendingItem.calories,
        imageUrl: pendingItem.imageUrl,
        label: `${pendingItem.foodName} ${Math.round(pendingItem.carbs)}g C`,
      },
      suggested: {
        foodId: suggestion.id,
        name: suggestion.name,
        carbs: suggestion.carbs,
        protein: suggestion.protein,
        calories: suggestion.calories,
        imageUrl: resolveFoodImageUrl(suggestion),
        label: `${suggestion.name} ${Math.round(suggestion.carbs)}g C`,
        reason:
          carbDelta < 0
            ? 'Lower glycemic load with solid protein'
            : proteinDelta > 0
              ? 'Higher protein at a similar calorie cost'
              : 'Closer macro fit for your remaining targets',
        deltas: {
          carbs: carbDelta,
          protein: proteinDelta,
          calories: suggestion.calories - pendingItem.calories,
        },
      },
    };
  }
}

function buildMealSlots(
  items: MealItemWithFood[],
  logsByItemId: Map<string, { status: string }>,
  hasWorkoutPlan: boolean,
) {
  return MEAL_TYPES.map((mealType) => {
    const slotItems = items.filter((item) => item.mealType === mealType);
    const itemStatuses = slotItems.map(
      (item) => logsByItemId.get(item.id)?.status ?? 'pending',
    );
    const status = resolveSlotStatus(itemStatuses);
    const macros = slotItems.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fats: acc.fats + item.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );

    const mappedItems = slotItems.map((item) => ({
      id: item.id,
      mealType,
      foodId: item.foodId,
      foodName: item.food.name,
      quantity: item.quantity,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      imageUrl: resolveFoodImageUrl(item.food),
      category: item.food.category ?? null,
      logStatus: logsByItemId.get(item.id)?.status ?? 'pending',
    }));

    const description =
      mappedItems.length > 0
        ? mappedItems.map((item) => formatFoodLine(item)).join(' · ')
        : 'No meal planned';

    return {
      mealType,
      displayName: MEAL_DISPLAY_NAMES[mealType] ?? mealType.toUpperCase(),
      scheduledTime: MEAL_SCHEDULE[mealType] ?? null,
      tag: resolveMealTag(mealType, macros, hasWorkoutPlan),
      description,
      imageUrl: mappedItems[0]?.imageUrl ?? null,
      macros: {
        calories: Math.round(macros.calories),
        protein: round1(macros.protein),
        carbs: round1(macros.carbs),
        fats: round1(macros.fats),
      },
      status,
      items: mappedItems,
      canSwap: status === 'pending' && mappedItems.length > 0,
      canEdit: mappedItems.length > 0,
    };
  }).filter((slot) => slot.items.length > 0 || slot.mealType === 'breakfast');
}

function resolveMealTag(
  mealType: string,
  macros: { calories: number; protein: number; carbs: number; fats: number },
  hasWorkoutPlan: boolean,
): string {
  // Post-workout snack is always the critical recovery window in the UI.
  if (mealType === 'snack') {
    return hasWorkoutPlan ? 'CRITICAL' : 'RECOVERY';
  }

  const proteinCals =
    macros.calories > 0 ? (macros.protein * 4) / macros.calories : 0;
  if (proteinCals >= 0.3 || macros.protein >= 35) {
    return 'HIGH PROTEIN';
  }
  if (macros.carbs >= 55) {
    return 'ENERGY';
  }
  if (mealType === 'breakfast') {
    return 'FOUNDATION';
  }
  if (macros.fats >= 25 && macros.protein < 25) {
    return 'SATIETY';
  }
  return 'BALANCED';
}

function formatFoodLine(item: { quantity: number; foodName: string }) {
  return item.quantity === 1
    ? item.foodName
    : `${item.quantity}× ${item.foodName}`;
}

function resolveSlotStatus(statuses: string[]) {
  if (statuses.length === 0) {
    return 'pending';
  }
  if (statuses.every((s) => s === 'completed' || s === 'replaced')) {
    return 'completed';
  }
  if (statuses.every((s) => s === 'skipped')) {
    return 'skipped';
  }
  if (statuses.some((s) => s === 'completed' || s === 'replaced')) {
    return 'partial';
  }
  return 'pending';
}

function sumConsumedMacros(meals: ReturnType<typeof buildMealSlots>) {
  return meals
    .filter((m) => m.status === 'completed' || m.status === 'partial')
    .reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fats: acc.fats + meal.macros.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
}

function buildVitals(
  consumed: { carbs: number; protein: number; calories: number },
  meals: ReturnType<typeof buildMealSlots>,
) {
  const fiberEstimate = Math.round(consumed.carbs * 0.12);
  const fiberPercent = percentOf(fiberEstimate, FIBER_TARGET_G);
  const completedCount = meals.filter((m) => m.status === 'completed').length;

  return {
    fiber: {
      currentG: fiberEstimate,
      targetG: FIBER_TARGET_G,
      percent: fiberPercent,
      status: fiberPercent >= 80 ? 'good' : fiberPercent >= 50 ? 'moderate' : 'low',
      estimated: true,
    },
    sodium: {
      status: completedCount >= 2 ? 'moderate' : 'unknown',
      label: completedCount >= 3 ? 'High' : 'Normal',
      estimated: true,
    },
    caffeine: {
      currentMg: 0,
      status: 'low',
      estimated: true,
      note: 'Caffeine tracking not configured',
    },
  };
}

function buildCoachInsight(input: {
  meals: ReturnType<typeof buildMealSlots>;
  proteinTarget: number;
  proteinConsumed: number;
  caloriesTarget: number;
  caloriesConsumed: number;
}) {
  const lunch = input.meals.find((m) => m.mealType === 'lunch');
  const proteinGap = input.proteinTarget - input.proteinConsumed;

  if (lunch && lunch.status === 'completed' && proteinGap > 10) {
    return {
      status: 'ACTIVE_ANALYSIS',
      message: `Your lunch is lacking ${Math.round(proteinGap)}g of high-quality protein to hit your daily target. Consider adding Greek yogurt or paneer as a side.`,
      actionable: true,
      suggestedAction: 'APPLY_SUGGESTIONS',
    };
  }

  if (input.caloriesConsumed > input.caloriesTarget * 0.9 && proteinGap > 20) {
    return {
      status: 'ACTIVE_ANALYSIS',
      message: `You're close to your calorie target but still need ${Math.round(proteinGap)}g protein. Prioritize lean protein for remaining meals.`,
      actionable: true,
      suggestedAction: 'APPLY_SUGGESTIONS',
    };
  }

  const pending = input.meals.filter((m) => m.status === 'pending').length;
  if (pending > 0) {
    return {
      status: 'ACTIVE_ANALYSIS',
      message: `You have ${pending} meal${pending > 1 ? 's' : ''} remaining today. Stay on track to maintain your transformation momentum.`,
      actionable: false,
      suggestedAction: null,
    };
  }

  return {
    status: 'ON_TRACK',
    message:
      'Great work today — all planned meals are logged. Recovery and hydration are key for tomorrow.',
    actionable: false,
    suggestedAction: null,
  };
}

function buildPhaseLabel(dietPlan: DietPlan, fitnessGoal?: string | null) {
  const focus = GOAL_PHASE_LABELS[fitnessGoal ?? ''] ?? 'TRANSFORMATION';
  return `PHASE ${dietPlan.version}: ${focus}`;
}

function buildStatusMessage(fitnessGoal?: string | null) {
  return GOAL_STATUS_MESSAGES[fitnessGoal ?? ''] ?? GOAL_STATUS_MESSAGES.maintenance;
}

function computeCompliance(meals: ReturnType<typeof buildMealSlots>) {
  if (meals.length === 0) {
    return 0;
  }
  const completed = meals.filter((m) => m.status === 'completed').length;
  return Math.round((completed / meals.length) * 100);
}

function resolveDayNumber(
  mealPlan: { startDate: Date | string | null; items: MealPlanItem[] },
  date: Date,
) {
  const maxDay = mealPlan.items.reduce(
    (max, item) => Math.max(max, item.dayNumber),
    7,
  );
  if (mealPlan.startDate) {
    const start = startOfLocalDay(mealPlan.startDate);
    const diffDays = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
    return (diffDays % maxDay) + 1;
  }
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Accept Date or ISO string (e.g. Redis-cached meal plan startDate). */
function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Invalid date value: ${String(value)}`);
  }
  return parsed;
}

function startOfLocalDay(date: Date | string) {
  const d = toDate(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function percentOf(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((current / target) * 100));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
