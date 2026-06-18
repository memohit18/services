import type { SubmissionStatus } from '../../../db-schema/mongodb/schemas/submission.schema';

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

export type SubmissionListResponse = {
  items: SubmissionResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    questionId: number;
  };
};
