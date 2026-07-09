import { BadRequestException } from '@nestjs/common';
import {
  assertNoDuplicateFoodIds,
  flattenPreferenceGroups,
} from './food-preferences.util';

describe('food-preferences.util', () => {
  describe('assertNoDuplicateFoodIds', () => {
    it('allows unique food IDs across groups', () => {
      expect(() =>
        assertNoDuplicateFoodIds({
          favorites: ['a'],
          available: ['b'],
          restricted: ['c'],
          allergies: ['d'],
        }),
      ).not.toThrow();
    });

    it('rejects duplicate food IDs across groups', () => {
      expect(() =>
        assertNoDuplicateFoodIds({
          favorites: ['a', 'b'],
          available: ['b'],
          restricted: [],
          allergies: [],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('flattenPreferenceGroups', () => {
    it('maps groups to preference rows', () => {
      const rows = flattenPreferenceGroups({
        favorites: ['f1'],
        available: ['a1'],
        restricted: ['r1'],
        allergies: ['al1'],
      });
      expect(rows).toEqual([
        { foodId: 'f1', preferenceType: 'favorite' },
        { foodId: 'a1', preferenceType: 'available' },
        { foodId: 'r1', preferenceType: 'restricted' },
        { foodId: 'al1', preferenceType: 'allergy' },
      ]);
    });
  });
});
