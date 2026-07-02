import mongoose from 'mongoose';
import { compareTestcaseOutput } from '../src/common/utils/testcase-judge.util';
import {
  dedupeIndexPairInput,
  findValidIndexPairs,
  isIndexPairSumAnswer,
  looksLikeIndexPairInput,
} from '../src/common/utils/index-pair-judge.util';
import { CodeRunnerService } from '../src/submissions/judging/code-runner.service';
import { normalizeJudgeInput } from '../src/submissions/judging/normalize-judge-input.util';

export const QUESTIONS_COLLECTION = 'questions';
export const TEST_CASES_COLLECTION = 'test_cases';

export type TestcaseAuditIssue =
  | 'invalid_expected'
  | 'ambiguous_pairs'
  | 'invalid_input'
  | 'runtime_error';

export type TestcaseAuditResult = {
  index: number;
  testcaseId: unknown;
  isSample: boolean;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  actualOutput?: unknown;
  issue: TestcaseAuditIssue;
  detail: string;
  validPairs?: number[][];
};

export type QuestionAuditSummary = {
  questionId: number;
  title: string;
  outputType?: string;
  total: number;
  issues: TestcaseAuditResult[];
};

/** Reference solutions for audit — extend as needed. */
export const REFERENCE_SOLUTIONS: Record<
  number,
  { language: string; code: string }
> = {
  1: {
    language: 'python',
    code: `def two_sum(nums, target):
    seen = {}
    for i, val in enumerate(nums):
        need = target - val
        if need in seen:
            return [seen[need], i]
        seen[val] = i
    return []`,
  },
};

export { findValidIndexPairs } from '../src/common/utils/index-pair-judge.util';

export async function auditQuestionTestcases(
  questionId: number,
  runner: CodeRunnerService,
): Promise<QuestionAuditSummary> {
  const questions = mongoose.connection.collection(QUESTIONS_COLLECTION);
  const testCases = mongoose.connection.collection(TEST_CASES_COLLECTION);

  const question = await questions.findOne({ questionId });
  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const reference = REFERENCE_SOLUTIONS[questionId];
  if (!reference) {
    throw new Error(`No reference solution for questionId ${questionId}`);
  }

  const cases = await testCases
    .find({ questionId })
    .sort({ 'input.n': 1, createdAt: 1 })
    .toArray();

  const issues: TestcaseAuditResult[] = [];

  for (let index = 0; index < cases.length; index += 1) {
    const testcase = cases[index];
    let input: Record<string, unknown>;

    try {
      input = normalizeJudgeInput(testcase.input);
    } catch (error) {
      issues.push({
        index: index + 1,
        testcaseId: testcase._id,
        isSample: Boolean(testcase.isSample),
        input: (testcase.input ?? {}) as Record<string, unknown>,
        expectedOutput: testcase.expectedOutput,
        issue: 'invalid_input',
        detail: error instanceof Error ? error.message : 'Invalid input',
      });
      continue;
    }

    if (looksLikeIndexPairInput(input)) {
      const nums = input.nums as number[];
      const target = input.target as number;
      const pairs = findValidIndexPairs(nums, target);

      if (pairs.length === 0) {
        issues.push({
          index: index + 1,
          testcaseId: testcase._id,
          isSample: Boolean(testcase.isSample),
          input,
          expectedOutput: testcase.expectedOutput,
          issue: 'invalid_expected',
          detail: 'No index pair sums to target',
          validPairs: pairs,
        });
        continue;
      }

      if (
        !isIndexPairSumAnswer(input, testcase.expectedOutput) &&
        pairs.length > 0
      ) {
        issues.push({
          index: index + 1,
          testcaseId: testcase._id,
          isSample: Boolean(testcase.isSample),
          input,
          expectedOutput: testcase.expectedOutput,
          issue: 'invalid_expected',
          detail: 'expectedOutput is not a valid index pair for nums/target',
          validPairs: pairs,
        });
        continue;
      }

      if (pairs.length > 1) {
        issues.push({
          index: index + 1,
          testcaseId: testcase._id,
          isSample: Boolean(testcase.isSample),
          input,
          expectedOutput: testcase.expectedOutput,
          issue: 'ambiguous_pairs',
          detail: `Multiple valid pairs: ${pairs.map((p) => `[${p.join(',')}]`).join(', ')}`,
          validPairs: pairs,
        });
      }
    }

    const run = await runner.run(reference.language, reference.code, input, {
      timeoutMs: question.timeLimitMs ?? 2000,
    });

    if (!run.ok) {
      issues.push({
        index: index + 1,
        testcaseId: testcase._id,
        isSample: Boolean(testcase.isSample),
        input,
        expectedOutput: testcase.expectedOutput,
        issue: 'runtime_error',
        detail: run.message,
      });
      continue;
    }

    const passed = compareTestcaseOutput(
      run.output,
      {
        validationType: testcase.validationType,
        expectedOutput: testcase.expectedOutput,
        expectedOutputCount: testcase.expectedOutputCount,
      },
      question.outputType,
      input,
    );

    if (!passed) {
      issues.push({
        index: index + 1,
        testcaseId: testcase._id,
        isSample: Boolean(testcase.isSample),
        input,
        expectedOutput: testcase.expectedOutput,
        actualOutput: run.output,
        issue: 'invalid_expected',
        detail: `Reference solution output ${JSON.stringify(run.output)} does not match expected`,
      });
    }
  }

  return {
    questionId,
    title: String(question.title ?? ''),
    outputType: question.outputType,
    total: cases.length,
    issues,
  };
}

export async function applyTestcaseFixes(
  issues: TestcaseAuditResult[],
  options: { fixExpected: boolean; fixAmbiguousInput: boolean },
): Promise<number> {
  const testCases = mongoose.connection.collection(TEST_CASES_COLLECTION);
  let updated = 0;

  for (const issue of issues) {
    if (issue.issue === 'invalid_expected' && options.fixExpected && issue.actualOutput) {
      await testCases.updateOne(
        { _id: issue.testcaseId },
        {
          $set: {
            expectedOutput: issue.actualOutput,
            validationType: 'exact',
          },
        },
      );
      updated += 1;
      continue;
    }

    if (issue.issue === 'ambiguous_pairs' && options.fixAmbiguousInput && issue.validPairs) {
      const nums = issue.input.nums as number[];
      const target = issue.input.target as number;
      const expected = issue.expectedOutput as number[];
      const preferred: [number, number] = isIndexPairSumAnswer(issue.input, expected)
        ? [expected[0], expected[1]]
        : [issue.validPairs[0][0], issue.validPairs[0][1]];

      const dedupedNums = dedupeIndexPairInput(nums, target, preferred);

      await testCases.updateOne(
        { _id: issue.testcaseId },
        {
          $set: {
            'input.nums': dedupedNums,
            expectedOutput: preferred,
          },
        },
      );
      updated += 1;
    }
  }

  return updated;
}
