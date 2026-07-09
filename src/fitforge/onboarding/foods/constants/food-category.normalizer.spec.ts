import { BadRequestException } from '@nestjs/common';
import {
  normalizeFoodCategory,
  transformFoodCategoryInput,
  transformFoodCategoryUpdate,
} from './food-category.normalizer';

describe('normalizeFoodCategory', () => {
  it('maps carbs alias to grain', () => {
    expect(normalizeFoodCategory('carbs')).toBe('grain');
    expect(normalizeFoodCategory('Carbs')).toBe('grain');
  });

  it('accepts canonical category values', () => {
    expect(normalizeFoodCategory('protein')).toBe('protein');
  });

  it('rejects unknown categories with helpful error', () => {
    expect(() => normalizeFoodCategory('invalid_cat')).toThrow(BadRequestException);
  });
});

describe('transformFoodCategoryUpdate', () => {
  it('returns null for empty string', () => {
    expect(transformFoodCategoryUpdate('')).toBeNull();
    expect(transformFoodCategoryUpdate(null)).toBeNull();
  });

  it('normalizes alias values', () => {
    expect(transformFoodCategoryUpdate('carbs')).toBe('grain');
  });
});

describe('transformFoodCategoryInput', () => {
  it('returns undefined for empty input', () => {
    expect(transformFoodCategoryInput(undefined)).toBeUndefined();
    expect(transformFoodCategoryInput('')).toBeUndefined();
  });
});
