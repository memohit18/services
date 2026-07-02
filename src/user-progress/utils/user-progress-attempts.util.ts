export type SubmissionAttemptStats = {
  questionId: number;
  attempts: number;
  lastAttemptedAt?: Date;
};

export function userIdMatchExpression(userId: string) {
  return { $eq: [{ $toString: '$userId' }, userId] };
}

export function buildUserIdFilter(userId: string) {
  return {
    $expr: userIdMatchExpression(userId),
  };
}

export function resolveAttemptCount(
  storedAttempts: number | undefined,
  submissionAttempts: number | undefined,
): number {
  return Math.max(storedAttempts ?? 0, submissionAttempts ?? 0);
}
