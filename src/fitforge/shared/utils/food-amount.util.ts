export type FoodServingUnit = 'g' | 'ml' | 'piece' | 'tbsp' | 'serving';

export type FoodServingInput = {
  name: string;
  category?: string | null;
  servingSize?: string | null;
  servingAmount?: number | null;
  servingUnit?: string | null;
};

export type ResolvedFoodServing = {
  servingAmount: number;
  servingUnit: FoodServingUnit;
  servingSize: string | null;
};

export type MealAmountView = {
  /** Planned servings (MealPlanItem.quantity). */
  quantity: number;
  /** Base portion size from food catalog. */
  servingAmount: number;
  servingUnit: FoodServingUnit;
  /** Legacy free-text label. */
  servingSize: string | null;
  /** quantity × servingAmount (e.g. 1.5 × 240 = 360). */
  amount: number;
  /** Human label for UI, e.g. "360 ml" or "2 pieces". */
  amountLabel: string;
};

const LIQUID_NAME_RE =
  /(milk|lassi|buttermilk|smoothie|shake|juice|chai|coffee|tea|water|thandai|nimbu|jaljeera|aam panna|soup)/i;

function normalizeUnit(unit: string | null | undefined): FoodServingUnit | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') return 'g';
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return 'ml';
  if (u === 'piece' || u === 'pieces' || u === 'pc' || u === 'pcs') return 'piece';
  if (u === 'tbsp' || u === 'tablespoon') return 'tbsp';
  if (u === 'serving' || u === 'servings') return 'serving';
  return null;
}

function isLikelyLiquid(food: FoodServingInput): boolean {
  const category = (food.category ?? '').toLowerCase();
  if (category === 'beverage') return true;
  if (LIQUID_NAME_RE.test(food.name)) return true;
  if (category === 'dairy' && /(glass|cup)/i.test(food.servingSize ?? '')) {
    return !/(paneer|cheese|curd|yogurt|raita|kheer|shrikhand|butter|ghee)/i.test(
      food.name,
    );
  }
  return false;
}

function parseServingSize(servingSize: string | null | undefined): {
  amount: number;
  unit: FoodServingUnit;
} | null {
  if (!servingSize?.trim()) return null;
  const text = servingSize.trim();

  const paren = text.match(/\((\d+(?:\.\d+)?)\s*(g|ml|kg|l)\)/i);
  if (paren) {
    const amount = Number(paren[1]);
    const unit = paren[2].toLowerCase();
    if (unit === 'kg') return { amount: amount * 1000, unit: 'g' };
    if (unit === 'l') return { amount: amount * 1000, unit: 'ml' };
    return { amount, unit: unit as 'g' | 'ml' };
  }

  const prefix = text.match(/^(\d+(?:\.\d+)?)\s*(g|ml|kg|l)\b/i);
  if (prefix) {
    const amount = Number(prefix[1]);
    const unit = prefix[2].toLowerCase();
    if (unit === 'kg') return { amount: amount * 1000, unit: 'g' };
    if (unit === 'l') return { amount: amount * 1000, unit: 'ml' };
    return { amount, unit: unit as 'g' | 'ml' };
  }

  const pieces = text.match(
    /^(\d+(?:\.\d+)?)\s*(pieces?|pcs?|slices?|sticks?)\b/i,
  );
  if (pieces) {
    return { amount: Number(pieces[1]), unit: 'piece' };
  }

  if (/^\d+\s*medium\b/i.test(text) || /^1\s*piece\b/i.test(text)) {
    return { amount: 1, unit: 'piece' };
  }

  if (/tbsp/i.test(text)) return { amount: 15, unit: 'g' };
  if (/tsp/i.test(text)) return { amount: 5, unit: 'g' };

  return null;
}

/**
 * Resolve a food's base portion for display.
 * Prefers DB servingAmount/servingUnit, then parses servingSize, then heuristics.
 */
export function resolveFoodServing(food: FoodServingInput): ResolvedFoodServing {
  const fromDbAmount = food.servingAmount;
  const fromDbUnit = normalizeUnit(food.servingUnit);
  if (
    fromDbAmount != null &&
    Number.isFinite(fromDbAmount) &&
    fromDbAmount > 0 &&
    fromDbUnit
  ) {
    return {
      servingAmount: fromDbAmount,
      servingUnit: fromDbUnit,
      servingSize: food.servingSize ?? null,
    };
  }

  const parsed = parseServingSize(food.servingSize);
  if (parsed) {
    return {
      servingAmount: parsed.amount,
      servingUnit: parsed.unit,
      servingSize: food.servingSize ?? null,
    };
  }

  const size = (food.servingSize ?? '').toLowerCase();
  if (isLikelyLiquid(food) || /glass/.test(size)) {
    return {
      servingAmount: 250,
      servingUnit: 'ml',
      servingSize: food.servingSize ?? '250 ml',
    };
  }
  if (/cup/.test(size)) {
    return {
      servingAmount: isLikelyLiquid(food) ? 240 : 150,
      servingUnit: isLikelyLiquid(food) ? 'ml' : 'g',
      servingSize: food.servingSize ?? null,
    };
  }
  if (/bowl|plate/.test(size)) {
    return {
      servingAmount: 150,
      servingUnit: 'g',
      servingSize: food.servingSize ?? null,
    };
  }

  return {
    servingAmount: 1,
    servingUnit: 'serving',
    servingSize: food.servingSize ?? null,
  };
}

function roundAmount(value: number): number {
  if (Number.isInteger(value)) return value;
  return Math.round(value * 10) / 10;
}

export function formatAmountLabel(
  amount: number,
  unit: FoodServingUnit,
): string {
  const rounded = roundAmount(amount);
  if (unit === 'piece') {
    return `${rounded} ${rounded === 1 ? 'piece' : 'pieces'}`;
  }
  if (unit === 'tbsp') {
    return `${rounded} tbsp`;
  }
  if (unit === 'serving') {
    return `${rounded} ${rounded === 1 ? 'serving' : 'servings'}`;
  }
  return `${rounded} ${unit}`;
}

/** Build amount fields for a meal plan item given food + quantity. */
export function toMealAmountView(
  food: FoodServingInput,
  quantity: number,
): MealAmountView {
  const serving = resolveFoodServing(food);
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const amount = roundAmount(qty * serving.servingAmount);
  return {
    quantity: qty,
    servingAmount: serving.servingAmount,
    servingUnit: serving.servingUnit,
    servingSize: serving.servingSize,
    amount,
    amountLabel: formatAmountLabel(amount, serving.servingUnit),
  };
}

/** e.g. "250 ml Milk" / "150 g Poha" */
export function formatFoodAmountLine(
  foodName: string,
  amount: MealAmountView,
): string {
  return `${amount.amountLabel} ${foodName}`;
}
