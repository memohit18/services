import type { QuestionOutputType } from '../../../db-schema/mongodb/schemas/question.schema';
import type { SubmissionStatus } from '../../../db-schema/mongodb/schemas/submission.schema';
import type { TestCaseValidationType } from '../../../db-schema/mongodb/schemas/test-case.schema';

export type JudgeTestCase = {
  input: unknown;
  validationType?: TestCaseValidationType;
  expectedOutput?: unknown;
  expectedOutputCount?: number;
};

export type RunCodeResult =
  | { ok: true; output: unknown; executionTimeMs: number }
  | { ok: false; errorType: 'compilation' | 'runtime' | 'timeout'; message: string; executionTimeMs: number };

export type JudgeTestCaseResultStatus =
  | 'passed'
  | 'wrong_answer'
  | 'runtime_error'
  | 'compilation_error'
  | 'time_limit_exceeded'
  | 'invalid_input'
  | 'skipped';

export type JudgeTestCaseResult = {
  index: number;
  isSample: boolean;
  isHidden: boolean;
  input: unknown;
  validationType: TestCaseValidationType;
  expectedOutput?: unknown;
  expectedOutputCount?: number;
  actualOutput?: unknown;
  passed: boolean;
  status: JudgeTestCaseResultStatus;
  executionTimeMs: number;
  message?: string;
};

export type JudgeSubmissionResult = {
  status: SubmissionStatus;
  passedTestCases: number;
  totalTestCases: number;
  executionTime: number;
  memoryUsed?: number;
  /** First failure message when status is not Accepted */
  failureReason?: string;
  testCases: JudgeTestCaseResult[];
};

export type JudgeContext = {
  outputType?: QuestionOutputType;
  testcases: JudgeTestCase[];
};
