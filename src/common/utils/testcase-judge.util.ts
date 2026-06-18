import type { QuestionOutputType } from '../../../db-schema/mongodb/schemas/question.schema';
import type { TestCaseValidationType } from '../../../db-schema/mongodb/schemas/test-case.schema';

export type TestcaseJudgeInput = {
  validationType?: TestCaseValidationType;
  expectedOutput?: unknown;
  expectedOutputCount?: number;
};

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

  return output;
}

export function compareTestcaseOutput(
  userOutput: unknown,
  testcase: TestcaseJudgeInput,
  questionOutputType?: QuestionOutputType,
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

  return deepEqual(normalizedUser, normalizedExpected);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
