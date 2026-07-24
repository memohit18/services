/**
 * Validates LeetCode-style "return two indices" answers when input has
 * nums/numbers + target. Supports classic Two Sum (0-based `nums`) and
 * Two Sum II (1-based `numbers`).
 */

function getIndexPairNums(input: Record<string, unknown>): number[] | null {
  const raw = input.nums ?? input.numbers;
  if (!Array.isArray(raw)) {
    return null;
  }
  if (!raw.every((v) => typeof v === 'number')) {
    return null;
  }
  return raw as number[];
}

function isValidZeroBasedPair(
  nums: number[],
  target: number,
  left: number,
  right: number,
): boolean {
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
  return nums[left] + nums[right] === target;
}

function isValidOneBasedPair(
  nums: number[],
  target: number,
  left: number,
  right: number,
): boolean {
  if (
    !Number.isInteger(left) ||
    !Number.isInteger(right) ||
    left === right ||
    left < 1 ||
    right < 1 ||
    left > nums.length ||
    right > nums.length
  ) {
    return false;
  }
  return nums[left - 1] + nums[right - 1] === target;
}

/**
 * True when output is any valid index pair summing to target
 * (0-based or 1-based).
 */
export function isIndexPairSumAnswer(
  input: Record<string, unknown>,
  output: unknown,
): boolean {
  const nums = getIndexPairNums(input);
  const target = input.target;

  if (!nums || typeof target !== 'number' || !Array.isArray(output)) {
    return false;
  }

  if (output.length !== 2) {
    return false;
  }

  const [left, right] = output;
  if (typeof left !== 'number' || typeof right !== 'number') {
    return false;
  }

  return (
    isValidZeroBasedPair(nums, target, left, right) ||
    isValidOneBasedPair(nums, target, left, right)
  );
}

export function looksLikeIndexPairInput(input: Record<string, unknown>): boolean {
  return getIndexPairNums(input) !== null && typeof input.target === 'number';
}

/** Ensure nums/target has exactly one valid index pair (keeps preferredPair, 0-based). */
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
