/**
 * Validates LeetCode-style "return two indices" answers when input has nums + target.
 */
export function isIndexPairSumAnswer(
  input: Record<string, unknown>,
  output: unknown,
): boolean {
  const nums = input.nums;
  const target = input.target;

  if (!Array.isArray(nums) || typeof target !== 'number' || !Array.isArray(output)) {
    return false;
  }

  if (output.length !== 2) {
    return false;
  }

  const [left, right] = output;
  if (
    !Number.isInteger(left) ||
    !Number.isInteger(right) ||
    left === right ||
    left < 0 ||
    right < 0 ||
    left >= nums.length ||
    right >= nums.length
  ) {
    return false;
  }

  const a = nums[left];
  const b = nums[right];
  if (typeof a !== 'number' || typeof b !== 'number') {
    return false;
  }

  return a + b === target;
}

export function looksLikeIndexPairInput(input: Record<string, unknown>): boolean {
  return Array.isArray(input.nums) && typeof input.target === 'number';
}

/** Ensure nums/target has exactly one valid index pair (keeps preferredPair). */
export function dedupeIndexPairInput(
  nums: number[],
  target: number,
  preferredPair: [number, number],
): number[] {
  const result = [...nums];
  const [prefI, prefJ] = preferredPair;

  const isPreferredPair = (i: number, j: number): boolean =>
    (i === prefI && j === prefJ) || (i === prefJ && j === prefI);

  for (let guard = 0; guard < 500; guard += 1) {
    const pairs = findValidIndexPairs(result, target);
    if (pairs.length <= 1) {
      return result;
    }

    const extra = pairs.find(([i, j]) => !isPreferredPair(i, j));
    if (!extra) {
      return result;
    }

    const [ei, ej] = extra;
    const tweakIndex =
      ei === prefI || ei === prefJ
        ? ej
        : ej === prefI || ej === prefJ
          ? ei
          : ej;
    let candidate = 1_000;

    while (candidate < 1_000_000) {
      const trial = [...result];
      trial[tweakIndex] = candidate;
      const trialPairs = findValidIndexPairs(trial, target);

      if (
        trialPairs.length === 1 &&
        isPreferredPair(trialPairs[0][0], trialPairs[0][1])
      ) {
        result[tweakIndex] = candidate;
        break;
      }

      candidate += 1;
    }
  }

  throw new Error('Could not dedupe index pair input');
}

export function findValidIndexPairs(nums: number[], target: number): number[][] {
  const pairs: number[][] = [];

  for (let i = 0; i < nums.length; i += 1) {
    for (let j = i + 1; j < nums.length; j += 1) {
      if (nums[i] + nums[j] === target) {
        pairs.push([i, j]);
      }
    }
  }

  return pairs;
}
