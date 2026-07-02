type RetryableErrorShape = {
  status?: number | string;
  message?: string;
  error?: {
    code?: number | string;
    status?: string;
    message?: string;
  };
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as RetryableErrorShape;
    return err.message ?? err.error?.message ?? String(error);
  }

  return String(error);
}

export function isQuotaExceededError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('quota exceeded') ||
    message.includes('exceeded your current quota') ||
    message.includes('check your plan and billing')
  );
}

export function isRetryableLlmError(error: unknown): boolean {
  if (!(error instanceof Error) && typeof error !== 'object') {
    return false;
  }

  // Quota/billing limits won't recover with short retries — switch provider instead.
  if (isQuotaExceededError(error)) {
    return false;
  }

  const err = error as RetryableErrorShape;
  const code = err.error?.code;
  const status = err.error?.status ?? err.status;
  const message = getErrorMessage(error);

  return (
    code === 503 ||
    code === 429 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('high demand') ||
    message.includes('overloaded') ||
    message.includes('rate limit')
  );
}

export function retryDelayMs(attempt: number, initialDelayMs = 500): number {
  return (
    Math.min(8_000, initialDelayMs * 2 ** attempt) +
    Math.floor(Math.random() * 200)
  );
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs?: number;
    onRetry?: (attempt: number, error: unknown, waitMs: number) => void;
  },
): Promise<T> {
  const { maxRetries, initialDelayMs = 500, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableLlmError(error) || attempt === maxRetries - 1) {
        throw error;
      }

      const waitMs = retryDelayMs(attempt, initialDelayMs);
      onRetry?.(attempt + 1, error, waitMs);
      await sleep(waitMs);
    }
  }

  throw lastError;
}

/** @deprecated Use isRetryableLlmError */
export const isRetryableGeminiError = isRetryableLlmError;

/** @deprecated Use callWithRetry */
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 2000,
): Promise<T> {
  return callWithRetry(fn, {
    maxRetries,
    initialDelayMs,
    onRetry: (attempt, _error, waitMs) => {
      console.log(`Retry ${attempt}/${maxRetries} after ${waitMs}ms`);
    },
  });
}
