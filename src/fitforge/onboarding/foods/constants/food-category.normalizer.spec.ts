import { BadRequestException } from '@nestjs/common';
import { normalizeFoodCategory } from './food-category.normalizer';

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
