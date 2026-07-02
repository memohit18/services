/**
 * Fetch all questions from MongoDB and set timeLimitMs using AI (Gemini / Grok).
 *
 * Usage:
 *   npm run questions:set-time-limits
 *   npm run questions:set-time-limits -- --dry-run
 *   npm run questions:set-time-limits -- --force
 *   npm run questions:set-time-limits -- --question-id=1
 *   npm run questions:set-time-limits -- --batch-size=20 --delay-ms=3000
 *
 * Requires: MONGODB_URL and at least one of GEMINI_API_KEY or GROK_API_KEY
 * Optional: LLM_PROVIDER_ORDER, GEMINI_MODEL, GROK_MODEL, LLM_MAX_RETRIES
 */
import mongoose from 'mongoose';
import { createLlmClientFromEnv } from '../src/common/ai/create-llm-client';
import { loadLlmConfigFromEnv } from '../src/common/ai/llm.config';
import {
  chunkArray,
  fetchQuestionsWithTestCounts,
  logQuestionContext,
  logSummary,
  logUpdateResult,
  parseArgs,
  QUESTIONS_COLLECTION,
  shouldUpdateQuestion,
  sleep,
  suggestTimeLimitsBatch,
  type TimeLimitUpdateResult,
} from './set-question-time-limits.lib';

async function main() {
  const startedAt = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGODB_URL;
  const llmConfig = loadLlmConfigFromEnv();

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is not set');
  }

  const llm = createLlmClientFromEnv((level, message) => {
    if (level === 'warn') {
      console.log(message);
    } else {
      console.error(message);
    }
  });

  if (!llm.isConfigured()) {
    throw new Error('Set GEMINI_API_KEY and/or GROK_API_KEY');
  }

  console.log('═'.repeat(72));
  console.log('Question time limit generator');
  console.log('═'.repeat(72));
  console.log(`mode: ${options.dryRun ? 'dry-run (no writes)' : 'write'}`);
  console.log(`force: ${options.force}`);
  console.log(`llm providers: ${llmConfig.providerOrder.join(' → ')}`);
  console.log(`configured: ${llm.getConfiguredProviders().join(', ')}`);
  console.log(`max retries per model: ${llmConfig.maxRetries}`);
  console.log(`batch size: ${options.batchSize} questions per request`);
  console.log(`delay between batches: ${options.delayMs}ms`);
  if (options.questionId) {
    console.log(`filter: questionId=${options.questionId}`);
  }
  console.log('');

  await mongoose.connect(mongoUrl);
  console.log('connected to MongoDB');
  console.log('');

  const results: TimeLimitUpdateResult[] = [];

  try {
    const questions = await fetchQuestionsWithTestCounts(options.questionId);
    if (questions.length === 0) {
      console.log('No questions found.');
      return;
    }

    const collection = mongoose.connection.collection(QUESTIONS_COLLECTION);
    const toProcess: typeof questions = [];

    console.log(`found ${questions.length} question(s)`);
    console.log('');

    for (const question of questions) {
      if (!shouldUpdateQuestion(question, options.force)) {
        const result: TimeLimitUpdateResult = {
          questionId: question.questionId,
          title: question.title,
          difficulty: question.difficulty,
          testcaseCount: question.testcaseCount,
          previousTimeLimitMs: question.timeLimitMs ?? null,
          newTimeLimitMs: question.timeLimitMs ?? 0,
          status: 'skipped',
        };
        results.push(result);
        logUpdateResult(result, results.length, questions.length);
        continue;
      }

      toProcess.push(question);
    }

    const batches = chunkArray(toProcess, options.batchSize);
    console.log(
      `processing ${toProcess.length} question(s) in ${batches.length} batch request(s)`,
    );
    console.log('');

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const batchLabel = `batch ${batchIndex + 1}/${batches.length}`;
      const questionIds = batch.map((question) => question.questionId).join(', ');

      console.log(`${batchLabel} — questionIds: ${questionIds}`);

      try {
        const suggestions = await suggestTimeLimitsBatch(llm, batch);

        for (const question of batch) {
          const suggestion = suggestions.get(question.questionId);
          if (!suggestion) {
            throw new Error(`Missing suggestion for question ${question.questionId}`);
          }

          console.log(
            `  evaluating #${question.questionId} ${question.title}`,
          );
          logQuestionContext(question);

          const previousTimeLimitMs = question.timeLimitMs ?? null;

          if (!options.dryRun) {
            await collection.updateOne(
              { questionId: question.questionId },
              { $set: { timeLimitMs: suggestion.timeLimitMs } },
            );
          }

          const result: TimeLimitUpdateResult = {
            questionId: question.questionId,
            title: question.title,
            difficulty: question.difficulty,
            testcaseCount: question.testcaseCount,
            previousTimeLimitMs,
            newTimeLimitMs: suggestion.timeLimitMs,
            reason: suggestion.reason,
            status: options.dryRun ? 'dry-run' : 'updated',
          };
          results.push(result);
          logUpdateResult(result, results.length, questions.length);
        }

        if (llm.getLastUsedProvider()) {
          console.log(
            `  used ${llm.getLastUsedProvider()} (${llm.getLastUsedModel()})`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ${batchLabel} failed: ${message}`);

        for (const question of batch) {
          const result: TimeLimitUpdateResult = {
            questionId: question.questionId,
            title: question.title,
            difficulty: question.difficulty,
            testcaseCount: question.testcaseCount,
            previousTimeLimitMs: question.timeLimitMs ?? null,
            newTimeLimitMs: question.timeLimitMs ?? 0,
            status: 'failed',
            error: message,
          };
          results.push(result);
          logUpdateResult(result, results.length, questions.length);
        }
      }

      if (options.delayMs > 0 && batchIndex < batches.length - 1) {
        console.log(`waiting ${options.delayMs}ms before next batch...`);
        console.log('');
        await sleep(options.delayMs);
      }
    }

    console.log('');
    logSummary(results);
    console.log(`elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  } finally {
    await mongoose.disconnect();
    console.log('disconnected from MongoDB');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
