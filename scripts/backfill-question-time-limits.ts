/**
 * Backfill timeLimitMs on existing question documents that are missing the field.
 *
 * Usage:
 *   npm run questions:backfill-time-limits
 *   npm run questions:backfill-time-limits -- --dry-run
 *
 * Requires: MONGODB_URL
 */
import mongoose from 'mongoose';
import {
  DEFAULT_QUESTION_TIME_LIMIT_MS,
  QUESTION_COLLECTION,
} from '../db-schema/mongodb/constants/question.constants';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is not set');
  }

  await mongoose.connect(mongoUrl);
  const collection = mongoose.connection.collection(QUESTION_COLLECTION);

  try {
    const filter = {
      $or: [{ timeLimitMs: { $exists: false } }, { timeLimitMs: null }],
    };

    const missingCount = await collection.countDocuments(filter);
    console.log('═'.repeat(72));
    console.log('Backfill question timeLimitMs');
    console.log('═'.repeat(72));
    console.log(`default: ${DEFAULT_QUESTION_TIME_LIMIT_MS}ms`);
    console.log(`questions missing field: ${missingCount}`);
    console.log(`mode: ${dryRun ? 'dry-run' : 'write'}`);
    console.log('');

    if (missingCount === 0) {
      console.log('All questions already have timeLimitMs.');
      return;
    }

    if (dryRun) {
      const sample = await collection
        .find(filter)
        .project({ questionId: 1, title: 1, timeLimitMs: 1 })
        .sort({ questionId: 1 })
        .limit(10)
        .toArray();

      console.log('Sample questions that would be updated:');
      for (const question of sample) {
        console.log(
          `  #${question.questionId} ${question.title} -> ${DEFAULT_QUESTION_TIME_LIMIT_MS}ms`,
        );
      }
      if (missingCount > sample.length) {
        console.log(`  ... and ${missingCount - sample.length} more`);
      }
      return;
    }

    const result = await collection.updateMany(filter, {
      $set: { timeLimitMs: DEFAULT_QUESTION_TIME_LIMIT_MS },
    });

    console.log(`updated ${result.modifiedCount} question(s) to ${DEFAULT_QUESTION_TIME_LIMIT_MS}ms`);
  } finally {
    await mongoose.disconnect();
    console.log('disconnected from MongoDB');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
