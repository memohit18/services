import { BadRequestException } from '@nestjs/common';
import {
  assertNoDuplicateFoodIds,
  flattenPreferenceGroups,
} from './food-preferences.util';

describe('food-preferences.util', () => {
  it('allows unique food IDs across groups', () => {
    expect(() =>
      assertNoDuplicateFoodIds({
        favorites: ['a'],
        available: ['b'],
        restricted: ['c'],
      }),
    ).not.toThrow();
  });

  it('rejects duplicate food IDs across groups', () => {
    expect(() =>
      assertNoDuplicateFoodIds({
        favorites: ['a', 'b'],
        available: ['b'],
        restricted: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('maps groups to preference rows', () => {
    expect(
      flattenPreferenceGroups({
        favorites: ['f1'],
        available: ['a1'],
        restricted: ['r1'],
      }),
    ).toEqual([
      { foodId: 'f1', preferenceType: 'favorite' },
      { foodId: 'a1', preferenceType: 'available' },
      { foodId: 'r1', preferenceType: 'restricted' },
    ]);
  });
});
