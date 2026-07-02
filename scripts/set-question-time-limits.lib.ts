import mongoose from 'mongoose';
import { DEFAULT_QUESTION_TIME_LIMIT_MS } from '../db-schema/mongodb/constants/question.constants';
import { LlmClient } from '../src/common/ai/llm.client';

export const QUESTIONS_COLLECTION = 'questions';
export const TEST_CASES_COLLECTION = 'test_cases';

export const MIN_TIME_LIMIT_MS = 500;
export const MAX_TIME_LIMIT_MS = 15_000;

export { DEFAULT_QUESTION_TIME_LIMIT_MS };

export type QuestionDoc = {
  questionId: number;
  title: string;
  category: string;
  pattern: string;
  difficulty: string;
  problemStatement: string;
  constraints?: string[];
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
  tags?: string[];
  timeLimitMs?: number;
};

export type QuestionWithTestCount = QuestionDoc & {
  testcaseCount: number;
};

export type AiTimeLimitResponse = {
  timeLimitMs: number;
  reason?: string;
};

export type AiBatchTimeLimitItem = {
  questionId: number;
  timeLimitMs: number;
  reason?: string;
};

export type AiBatchTimeLimitResponse = {
  results: AiBatchTimeLimitItem[];
};

export type ScriptOptions = {
  dryRun: boolean;
  force: boolean;
  questionId?: number;
  delayMs: number;
  batchSize: number;
};

export function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    delayMs: 3000,
    batchSize: 20,
  };

  const questionArg = argv.find((arg) => arg.startsWith('--question-id='));
  if (questionArg) {
    const parsed = Number(questionArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.questionId = parsed;
    }
  }

  const delayArg = argv.find((arg) => arg.startsWith('--delay-ms='));
  if (delayArg) {
    const parsed = Number(delayArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      options.delayMs = parsed;
    }
  }

  const batchArg = argv.find((arg) => arg.startsWith('--batch-size='));
  if (batchArg) {
    const parsed = Number(batchArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.batchSize = parsed;
    }
  }

  return options;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function clampTimeLimitMs(value: number): number {
  return Math.min(MAX_TIME_LIMIT_MS, Math.max(MIN_TIME_LIMIT_MS, Math.round(value)));
}

export function buildTimeLimitPrompt(question: QuestionWithTestCount): string {
  const statement =
    question.problemStatement.length > 1200
      ? `${question.problemStatement.slice(0, 1200)}...`
      : question.problemStatement;

  return `You are a competitive programming judge configuring per-test-case execution time limits.

Return JSON only:
{
  "timeLimitMs": number,
  "reason": string
}

Rules:
- timeLimitMs must be between ${MIN_TIME_LIMIT_MS} and ${MAX_TIME_LIMIT_MS}
- Easy problems: usually 1000-3000ms
- Medium problems: usually 2000-5000ms
- Hard problems: usually 3000-10000ms
- Increase limit when constraints imply large inputs (e.g. n up to 10^5 or 10^6)
- Decrease for trivial / math problems with tiny inputs
- This limit applies to EACH individual test case, not total submission time

Problem:
- questionId: ${question.questionId}
- title: ${question.title}
- difficulty: ${question.difficulty}
- category: ${question.category}
- pattern: ${question.pattern}
- expectedTimeComplexity: ${question.expectedTimeComplexity ?? 'unknown'}
- expectedSpaceComplexity: ${question.expectedSpaceComplexity ?? 'unknown'}
- testcaseCount: ${question.testcaseCount}
- constraints: ${JSON.stringify(question.constraints ?? [])}
- tags: ${JSON.stringify(question.tags ?? [])}
- problemStatement: ${statement}`;
}

function summarizeQuestionForBatch(question: QuestionWithTestCount): string {
  const statement =
    question.problemStatement.length > 400
      ? `${question.problemStatement.slice(0, 400)}...`
      : question.problemStatement;

  return [
    `questionId: ${question.questionId}`,
    `title: ${question.title}`,
    `difficulty: ${question.difficulty}`,
    `category: ${question.category}`,
    `pattern: ${question.pattern}`,
    `expectedTimeComplexity: ${question.expectedTimeComplexity ?? 'unknown'}`,
    `testcaseCount: ${question.testcaseCount}`,
    `constraints: ${JSON.stringify(question.constraints ?? [])}`,
    `problemStatement: ${statement}`,
  ].join('\n');
}

export function buildBatchTimeLimitPrompt(questions: QuestionWithTestCount[]): string {
  const blocks = questions.map(
    (question, index) => `--- Problem ${index + 1} ---\n${summarizeQuestionForBatch(question)}`,
  );

  return `You are a competitive programming judge configuring per-test-case execution time limits.

Return JSON only:
{
  "results": [
    {
      "questionId": number,
      "timeLimitMs": number,
      "reason": string
    }
  ]
}

Rules:
- Return exactly one entry per input problem (same questionId values).
- timeLimitMs must be between ${MIN_TIME_LIMIT_MS} and ${MAX_TIME_LIMIT_MS} for each problem.
- Easy problems: usually 1000-3000ms
- Medium problems: usually 2000-5000ms
- Hard problems: usually 3000-10000ms
- Increase limit when constraints imply large inputs (e.g. n up to 10^5 or 10^6)
- Decrease for trivial / math problems with tiny inputs
- This limit applies to EACH individual test case, not total submission time

Problems:
${blocks.join('\n\n')}`;
}

async function generateLlmJson<T>(
  client: LlmClient,
  prompt: string,
): Promise<T> {
  return client.generateJson<T>(prompt);
}

export async function suggestTimeLimitMs(
  client: LlmClient,
  question: QuestionWithTestCount,
): Promise<AiTimeLimitResponse> {
  const parsed = await generateLlmJson<AiTimeLimitResponse>(
    client,
    buildTimeLimitPrompt(question),
  );

  if (typeof parsed.timeLimitMs !== 'number' || !Number.isFinite(parsed.timeLimitMs)) {
    throw new Error(`Invalid AI response for question ${question.questionId}`);
  }

  return {
    timeLimitMs: clampTimeLimitMs(parsed.timeLimitMs),
    reason: parsed.reason,
  };
}

export async function suggestTimeLimitsBatch(
  client: LlmClient,
  questions: QuestionWithTestCount[],
): Promise<Map<number, AiTimeLimitResponse>> {
  if (questions.length === 0) {
    return new Map();
  }

  if (questions.length === 1) {
    const single = await suggestTimeLimitMs(client, questions[0]);
    return new Map([[questions[0].questionId, single]]);
  }

  const parsed = await generateLlmJson<AiBatchTimeLimitResponse>(
    client,
    buildBatchTimeLimitPrompt(questions),
  );

  if (!Array.isArray(parsed.results)) {
    throw new Error('Invalid batch AI response: missing results array');
  }

  const byQuestionId = new Map<number, AiTimeLimitResponse>();

  for (const entry of parsed.results) {
    if (typeof entry.questionId !== 'number' || !Number.isFinite(entry.questionId)) {
      continue;
    }
    if (typeof entry.timeLimitMs !== 'number' || !Number.isFinite(entry.timeLimitMs)) {
      throw new Error(`Invalid timeLimitMs for question ${entry.questionId}`);
    }
    byQuestionId.set(entry.questionId, {
      timeLimitMs: clampTimeLimitMs(entry.timeLimitMs),
      reason: entry.reason,
    });
  }

  for (const question of questions) {
    if (!byQuestionId.has(question.questionId)) {
      throw new Error(`Batch response missing questionId ${question.questionId}`);
    }
  }

  return byQuestionId;
}

export function shouldUpdateQuestion(
  question: QuestionDoc,
  force: boolean,
): boolean {
  if (force) {
    return true;
  }

  return question.timeLimitMs == null;
}

export async function fetchQuestionsWithTestCounts(
  questionId?: number,
): Promise<QuestionWithTestCount[]> {
  const questionsCollection = mongoose.connection.collection<QuestionDoc>(
    QUESTIONS_COLLECTION,
  );
  const testCasesCollection = mongoose.connection.collection(TEST_CASES_COLLECTION);

  const filter = questionId ? { questionId } : {};
  const questions = await questionsCollection
    .find(filter)
    .sort({ questionId: 1 })
    .toArray();

  if (questions.length === 0) {
    return [];
  }

  const questionIds = questions.map((question) => question.questionId);
  const counts = await testCasesCollection
    .aggregate<{ _id: number; count: number }>([
      { $match: { questionId: { $in: questionIds } } },
      { $group: { _id: '$questionId', count: { $sum: 1 } } },
    ])
    .toArray();

  const countByQuestionId = new Map(
    counts.map((entry) => [entry._id, entry.count]),
  );

  return questions.map((question) => ({
    ...question,
    testcaseCount: countByQuestionId.get(question.questionId) ?? 0,
  }));
}

export type TimeLimitUpdateResult = {
  questionId: number;
  title: string;
  difficulty: string;
  testcaseCount: number;
  previousTimeLimitMs: number | null;
  newTimeLimitMs: number;
  reason?: string;
  status: 'updated' | 'dry-run' | 'skipped' | 'failed';
  error?: string;
};

export const DEFAULT_TIME_LIMIT_MS = DEFAULT_QUESTION_TIME_LIMIT_MS;

export function formatTimeLimitMs(value: number | null | undefined): string {
  if (value == null) {
    return 'not set';
  }
  return `${value}ms`;
}

/** What the API/judge uses when the DB field is missing. */
export function formatEffectiveTimeLimitMs(value: number | null | undefined): string {
  if (value == null) {
    return `not set (API default: ${DEFAULT_TIME_LIMIT_MS}ms)`;
  }
  return `${value}ms`;
}

export function formatTimeLimitChange(
  previous: number | null | undefined,
  next: number,
): string {
  const before = previous ?? null;
  if (before == null) {
    return `not set (was using API default ${DEFAULT_TIME_LIMIT_MS}ms) -> ${next}ms`;
  }
  if (before === next) {
    return `${before}ms (unchanged)`;
  }
  const delta = next - before;
  const sign = delta > 0 ? '+' : '';
  return `${before}ms -> ${next}ms (${sign}${delta}ms)`;
}

export function logQuestionContext(question: QuestionWithTestCount): void {
  console.log(
    [
      `  difficulty: ${question.difficulty}`,
      `  category: ${question.category}`,
      `  pattern: ${question.pattern}`,
      `  test cases: ${question.testcaseCount}`,
      `  expected time: ${question.expectedTimeComplexity ?? 'n/a'}`,
      `  current limit: ${formatEffectiveTimeLimitMs(question.timeLimitMs)}`,
    ].join('\n'),
  );
}

export function logUpdateResult(result: TimeLimitUpdateResult, index: number, total: number): void {
  const prefix = `[${index}/${total}] #${result.questionId} ${result.title}`;

  switch (result.status) {
    case 'skipped':
      console.log(`${prefix}`);
      console.log(`  status: skipped`);
      console.log(`  runtime: ${formatTimeLimitMs(result.previousTimeLimitMs)}`);
      break;
    case 'failed':
      console.error(`${prefix}`);
      console.error(`  status: failed`);
      console.error(`  runtime: ${formatTimeLimitMs(result.previousTimeLimitMs)}`);
      console.error(`  error: ${result.error}`);
      break;
    case 'dry-run':
    case 'updated':
      console.log(`${prefix}`);
      console.log(`  status: ${result.status}`);
      console.log(
        `  runtime: ${formatTimeLimitChange(result.previousTimeLimitMs, result.newTimeLimitMs)}`,
      );
      if (result.reason) {
        console.log(`  reason: ${result.reason}`);
      }
      break;
  }

  console.log('');
}

export function logSummary(results: TimeLimitUpdateResult[]): void {
  const updated = results.filter((r) => r.status === 'updated' || r.status === 'dry-run');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');

  console.log('─'.repeat(72));
  console.log('Summary');
  console.log('─'.repeat(72));
  console.log(
    `total=${results.length} updated=${updated.length} skipped=${skipped.length} failed=${failed.length}`,
  );

  if (updated.length > 0) {
    console.log('');
    console.log('Runtime updates by question:');
    console.log('');
    console.log(
      [
        'ID'.padEnd(6),
        'Title'.padEnd(28),
        'Difficulty'.padEnd(10),
        'Before'.padEnd(10),
        'After'.padEnd(10),
        'Change'.padEnd(10),
      ].join(' | '),
    );
    console.log('─'.repeat(72));

    for (const result of updated) {
      const before = result.previousTimeLimitMs ?? null;
      const delta =
        before == null ? 'new' : result.newTimeLimitMs - before === 0
          ? '0ms'
          : `${result.newTimeLimitMs - before > 0 ? '+' : ''}${result.newTimeLimitMs - before}ms`;

      console.log(
        [
          String(result.questionId).padEnd(6),
          result.title.slice(0, 28).padEnd(28),
          result.difficulty.padEnd(10),
          formatTimeLimitMs(before).padEnd(10),
          formatTimeLimitMs(result.newTimeLimitMs).padEnd(10),
          delta.padEnd(10),
        ].join(' | '),
      );
    }
  }

  if (skipped.length > 0) {
    console.log('');
    console.log('Skipped (already had timeLimitMs — use --force to regenerate):');
    for (const result of skipped) {
      console.log(
        `  #${result.questionId} ${result.title} — ${formatTimeLimitMs(result.previousTimeLimitMs)}`,
      );
    }
  }

  if (failed.length > 0) {
    console.log('');
    console.log('Failed:');
    for (const result of failed) {
      console.log(`  #${result.questionId} ${result.title} — ${result.error}`);
    }
  }

  console.log('─'.repeat(72));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

