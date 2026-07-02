import type { QuestionOutputType } from '../../../db-schema/mongodb/schemas/question.schema';
import type { TestCaseValidationType } from '../../../db-schema/mongodb/schemas/test-case.schema';
import {
  isIndexPairSumAnswer,
  looksLikeIndexPairInput,
} from './index-pair-judge.util';

export type TestcaseJudgeInput = {
  validationType?: TestCaseValidationType;
  expectedOutput?: unknown;
  expectedOutputCount?: number;
};

function normalizeListLikeOutput(output: unknown[]): unknown[] {
  return output.map((value) =>
    value === null || value === undefined ? null : String(value),
  );
}

export function normalizeOutputForComparison(
  output: unknown,
  outputType?: QuestionOutputType,
): unknown {
  if (outputType === 'unordered_array' && Array.isArray(output)) {
    return [...output].map(String).sort();
  }

  if (outputType === 'unordered_nested_array' && Array.isArray(output)) {
    return [...output]
      .map((item) =>
        Array.isArray(item) ? [...item].map(String).sort().join('|') : String(item),
      )
      .sort();
  }

  if (outputType === 'linked_list' && Array.isArray(output)) {
    return normalizeListLikeOutput(output);
  }

  if (outputType === 'tree' && Array.isArray(output)) {
    return normalizeListLikeOutput(output);
  }

  if (outputType === 'count_only' && Array.isArray(output)) {
    return output.length;
  }

  return output;
}

export function compareTestcaseOutput(
  userOutput: unknown,
  testcase: TestcaseJudgeInput,
  questionOutputType?: QuestionOutputType,
  input?: Record<string, unknown>,
): boolean {
  const validationType = testcase.validationType ?? 'exact';

  if (validationType === 'count_only') {
    if (!Array.isArray(userOutput)) {
      return false;
    }

    return userOutput.length === testcase.expectedOutputCount;
  }

  const normalizedUser = normalizeOutputForComparison(userOutput, questionOutputType);
  const normalizedExpected = normalizeOutputForComparison(
    testcase.expectedOutput,
    questionOutputType,
  );

  if (deepEqual(normalizedUser, normalizedExpected)) {
    return true;
  }

  // Two Sum-style: accept any valid index pair that sums to target.
  if (
    input &&
    looksLikeIndexPairInput(input) &&
    isIndexPairSumAnswer(input, userOutput)
  ) {
    return true;
  }

  return false;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
