import { USER_PROGRESS_STATUSES } from '../../../db-schema/mongodb/schemas/user-progress.schema';

export type UserProgressStatus = (typeof USER_PROGRESS_STATUSES)[number];

export type QuestionUserProgress = {
  status: UserProgressStatus;
  attempts: number;
  confidence: number;
  lastAttemptedAt?: Date;
};

export function defaultQuestionUserProgress(): QuestionUserProgress {
  return {
    status: 'Not Started',
    attempts: 0,
    confidence: 1,
  };
}

export type UserProgressResponse = {
  questionId: number;
  status: UserProgressStatus;
  attempts: number;
  confidence: number;
  lastAttemptedAt?: Date;
  nextRevisionDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  question?: {
    title: string;
    difficulty: string;
    category: string;
  };
};

export type UserProgressListResponse = {
  items: UserProgressResponse[];
  meta: {
    total: number;
    appliedFilters: {
      status?: string;
    };
  };
  filters: {
    statuses: UserProgressStatus[];
    countsByStatus: Record<string, number>;
    totalQuestions: number;
  };
};

export function defaultUserProgress(questionId: number): UserProgressResponse {
  return {
    questionId,
    status: 'Not Started',
    attempts: 0,
    confidence: 1,
  };
}
