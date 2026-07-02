/**
 * Validate question testcases using a reference solution.
 *
 * Usage:
 *   npm run questions:validate-testcases -- --question-id=1
 *   npm run questions:validate-testcases -- --question-id=1 --fix-ambiguous
 */
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { CodeRunnerService } from '../src/submissions/judging/code-runner.service';
import {
  applyTestcaseFixes,
  auditQuestionTestcases,
} from './validate-question-testcases.lib';

function parseArgs(argv: string[]) {
  const questionArg = argv.find((arg) => arg.startsWith('--question-id='));
  const questionId = questionArg ? Number(questionArg.split('=')[1]) : 1;

  return {
    questionId: Number.isFinite(questionId) ? questionId : 1,
    fixExpected: argv.includes('--fix-expected'),
    fixAmbiguous: argv.includes('--fix-ambiguous'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is not set');
  }

  await mongoose.connect(mongoUrl);
  const runner = new CodeRunnerService(new ConfigService({ CODE_RUN_TIMEOUT_MS: '5000' }));

  try {
    const summary = await auditQuestionTestcases(options.questionId, runner);

    console.log(`Question #${summary.questionId}: ${summary.title}`);
    console.log(`testcases: ${summary.total}, issues: ${summary.issues.length}`);
    console.log('');

    for (const issue of summary.issues) {
      console.log(
        `#${issue.index} ${issue.isSample ? 'sample' : 'hidden'} [${issue.issue}] ${issue.detail}`,
      );
      console.log(`  input: ${JSON.stringify(issue.input)}`);
      console.log(`  expected: ${JSON.stringify(issue.expectedOutput)}`);
      if (issue.actualOutput !== undefined) {
        console.log(`  reference: ${JSON.stringify(issue.actualOutput)}`);
      }
    }

    if (options.fixExpected || options.fixAmbiguous) {
      const updated = await applyTestcaseFixes(summary.issues, {
        fixExpected: options.fixExpected,
        fixAmbiguousInput: options.fixAmbiguous,
      });
      console.log('');
      console.log(`Updated ${updated} testcase(s).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
