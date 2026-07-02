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

export type JudgeSubmissionResult = {
  status: SubmissionStatus;
  passedTestCases: number;
  totalTestCases: number;
  executionTime: number;
  memoryUsed?: number;
  /** First failure message when status is not Accepted */
  failureReason?: string;
};

export type JudgeContext = {
  outputType?: QuestionOutputType;
  testcases: JudgeTestCase[];
};
