/**
 * Normalize stored testcase input for the code runner.
 * Some uploads wrap params as { input: { nums, target } } instead of { nums, target }.
 */
export function normalizeJudgeInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid testcase input');
  }

  const record = input as Record<string, unknown>;

  if (
    Object.keys(record).length === 1 &&
    record.input &&
    typeof record.input === 'object' &&
    !Array.isArray(record.input)
  ) {
    return record.input as Record<string, unknown>;
  }

  return record;
}
