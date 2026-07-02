import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DEFAULT_QUESTION_TIME_LIMIT_MS } from '../../../db-schema/mongodb/constants/question.constants';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../../db-schema/mongodb/schemas/question.schema';
import type { SubmissionStatus } from '../../../db-schema/mongodb/schemas/submission.schema';
import {
  TEST_CASE_MODEL,
  TestCaseDocument,
} from '../../../db-schema/mongodb/schemas/test-case.schema';
import { compareTestcaseOutput } from '../../common/utils/testcase-judge.util';
import { CodeRunnerService } from './code-runner.service';
import { normalizeJudgeInput } from './normalize-judge-input.util';
import type { JudgeSubmissionResult } from './judge.types';

@Injectable()
export class CodeJudgeService {
  private readonly defaultTimeLimitMs: number;

  constructor(
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
    private readonly codeRunner: CodeRunnerService,
    private readonly config: ConfigService,
  ) {
    this.defaultTimeLimitMs = Number(
      this.config.get<string>('codeRunner.defaultQuestionTimeLimitMs') ??
        DEFAULT_QUESTION_TIME_LIMIT_MS,
    );
  }

  async judgeSubmission(
    questionId: number,
    language: string,
    code: string,
  ): Promise<JudgeSubmissionResult> {
    const question = await this.questionModel
      .findOne({ questionId })
      .select('questionId outputType timeLimitMs')
      .lean();

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const timeLimitMs = question.timeLimitMs ?? this.defaultTimeLimitMs;

    const testcases = await this.testCaseModel
      .find({ questionId })
      .sort({ 'input.n': 1, createdAt: 1 })
      .select('input validationType expectedOutput expectedOutputCount')
      .lean();

    if (testcases.length === 0) {
      throw new NotFoundException(`No test cases found for question ${questionId}`);
    }

    let passedTestCases = 0;
    let maxExecutionTime = 0;
    let status: SubmissionStatus = 'Accepted';
    let failureReason: string | undefined;

    for (const testcase of testcases) {
      let input: Record<string, unknown>;
      try {
        input = normalizeJudgeInput(testcase.input);
      } catch (error) {
        status = 'Runtime Error';
        failureReason =
          error instanceof Error ? error.message : 'Invalid testcase input';
        break;
      }

      const runResult = await this.codeRunner.run(language, code, input, {
        timeoutMs: timeLimitMs,
      });
      maxExecutionTime = Math.max(maxExecutionTime, runResult.executionTimeMs);

      if (!runResult.ok) {
        status = this.mapErrorToStatus(runResult.errorType);
        failureReason = runResult.message;
        break;
      }

      const passed = compareTestcaseOutput(
        runResult.output,
        {
          validationType: testcase.validationType,
          expectedOutput: testcase.expectedOutput,
          expectedOutputCount: testcase.expectedOutputCount,
        },
        question.outputType,
      );

      if (!passed) {
        status = 'Wrong Answer';
        failureReason = 'Output did not match expected result';
        break;
      }

      passedTestCases += 1;
    }

    if (status === 'Accepted' && passedTestCases < testcases.length) {
      status = 'Wrong Answer';
      failureReason ??= 'Not all test cases passed';
    }

    return {
      status,
      passedTestCases,
      totalTestCases: testcases.length,
      executionTime: maxExecutionTime,
      failureReason,
    };
  }

  private mapErrorToStatus(
    errorType: 'compilation' | 'runtime' | 'timeout',
  ): SubmissionStatus {
    switch (errorType) {
      case 'compilation':
        return 'Compilation Error';
      case 'timeout':
        return 'Time Limit Exceeded';
      default:
        return 'Runtime Error';
    }
  }
}
