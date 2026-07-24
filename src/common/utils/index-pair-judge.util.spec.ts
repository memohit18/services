import {
  findValidIndexPairs,
  isIndexPairSumAnswer,
  looksLikeIndexPairInput,
} from './index-pair-judge.util';
import { compareTestcaseOutput } from './testcase-judge.util';

describe('index-pair judge (Two Sum / Two Sum II)', () => {
  it('detects nums and numbers inputs', () => {
    expect(looksLikeIndexPairInput({ nums: [2, 7], target: 9 })).toBe(true);
    expect(
      looksLikeIndexPairInput({ numbers: [2, 7, 11, 15], target: 9 }),
    ).toBe(true);
    expect(looksLikeIndexPairInput({ height: [1, 8], target: 9 })).toBe(false);
  });

  it('accepts any valid 0-based pair for classic Two Sum', () => {
    const input = { nums: [3, 8, 12, 15, 20], target: 23 };
    expect(isIndexPairSumAnswer(input, [0, 4])).toBe(true);
    expect(isIndexPairSumAnswer(input, [1, 3])).toBe(true);
    expect(isIndexPairSumAnswer(input, [0, 3])).toBe(false);
  });

  it('accepts any valid 1-based pair for Two Sum II', () => {
    const input = { numbers: [3, 8, 12, 15, 20], target: 23 };
    expect(isIndexPairSumAnswer(input, [1, 5])).toBe(true); // 3+20
    expect(isIndexPairSumAnswer(input, [2, 4])).toBe(true); // 8+15
    expect(isIndexPairSumAnswer(input, [1, 4])).toBe(false);
  });

  it('compareTestcaseOutput accepts alternate Two Sum II answers', () => {
    const input = { numbers: [3, 8, 12, 15, 20], target: 23 };
    expect(
      compareTestcaseOutput([1, 5], { expectedOutput: [2, 4] }, 'exact', input),
    ).toBe(true);
  });

  it('findValidIndexPairs lists all 0-based solutions', () => {
    expect(findValidIndexPairs([3, 8, 12, 15, 20], 23)).toEqual([
      [0, 4],
      [1, 3],
    ]);
  });
});
