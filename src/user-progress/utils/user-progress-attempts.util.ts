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
    $or: [
      { userId },
      { $expr: userIdMatchExpression(userId) },
    ],
  };
}

/** Use for upserts — MongoDB rejects $expr / $or in upsert predicates (error 224). */
export function buildUserProgressWriteFilter(
  userId: string,
  questionId: number,
) {
  return { userId, questionId };
}

export function resolveAttemptCount(
  storedAttempts: number | undefined,
  submissionAttempts: number | undefined,
): number {
  return Math.max(storedAttempts ?? 0, submissionAttempts ?? 0);
}
