import {
  formatFoodAmountLine,
  toMealAmountView,
} from './food-amount.util';

describe('food-amount.util', () => {
  it('resolves milk as ml from servingSize', () => {
    const amount = toMealAmountView(
      {
        name: 'Milk',
        category: 'dairy',
        servingSize: '1 cup (240 ml)',
        servingAmount: 240,
        servingUnit: 'ml',
      },
      1.5,
    );

    expect(amount.amount).toBe(360);
    expect(amount.amountLabel).toBe('360 ml');
    expect(formatFoodAmountLine('Milk', amount)).toBe('360 ml Milk');
  });

  it('resolves paneer as grams', () => {
    const amount = toMealAmountView(
      {
        name: 'Paneer Raw',
        category: 'dairy',
        servingSize: '100g',
        servingAmount: 100,
        servingUnit: 'g',
      },
      1,
    );

    expect(amount.amount).toBe(100);
    expect(amount.amountLabel).toBe('100 g');
  });

  it('falls back to liquid heuristic for milk without structured fields', () => {
    const amount = toMealAmountView(
      {
        name: 'Milk',
        category: 'dairy',
        servingSize: '1 cup',
      },
      1,
    );

    expect(amount.servingUnit).toBe('ml');
    expect(amount.amount).toBeGreaterThan(0);
    expect(amount.amountLabel).toMatch(/ml$/);
  });
});
