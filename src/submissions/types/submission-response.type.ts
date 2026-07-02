import type { SubmissionStatus } from '../../../db-schema/mongodb/schemas/submission.schema';
import type { TestCaseValidationType } from '../../../db-schema/mongodb/schemas/test-case.schema';
import type {
  QuestionJudgingResponse,
  QuestionTestcaseSummary,
} from '../../questions/types/question-response.type';

export type SubmissionTestCaseResult = {
  index: number;
  isSample: boolean;
  isHidden: boolean;
  input: unknown;
  validationType: TestCaseValidationType;
  expectedOutput?: unknown;
  expectedOutputCount?: number;
  actualOutput?: unknown;
  passed: boolean;
  status:
    | 'passed'
    | 'wrong_answer'
    | 'runtime_error'
    | 'compilation_error'
    | 'time_limit_exceeded'
    | 'invalid_input'
    | 'skipped';
  executionTimeMs: number;
  message?: string;
};

export type SubmissionQuestionContext = {
  questionId: number;
  outputType?: string;
  timeLimitMs: number;
  judging: QuestionJudgingResponse;
  testcaseSummary: QuestionTestcaseSummary;
};

export type SubmissionResponse = {
  submissionId: string;
  userId: string;
  questionId: number;
  language: string;
  code: string;
  status?: SubmissionStatus;
  passedTestCases: number;
  totalTestCases: number;
  executionTime?: number;
  memoryUsed?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SubmissionCreateResponse = SubmissionResponse & {
  question: SubmissionQuestionContext;
  /** Per-testcase results (sample + hidden) */
  testCases: SubmissionTestCaseResult[];
  /** Present when status is not Accepted — helps debug judge failures */
  failureReason?: string;
};

export type SubmissionListResponse = {
  items: SubmissionResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    questionId: number;
  };
  question: SubmissionQuestionContext;
};
