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
import { resolveTestcaseValidationType } from '../../questions/types/question-response.type';
import { CodeRunnerService } from './code-runner.service';
import { normalizeJudgeInput } from './normalize-judge-input.util';
import type { JudgeSubmissionResult, JudgeTestCaseResult } from './judge.types';

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
      .select(
        'input validationType expectedOutput expectedOutputCount isSample isHidden',
      )
      .lean();

    if (testcases.length === 0) {
      throw new NotFoundException(`No test cases found for question ${questionId}`);
    }

    const testCaseResults: JudgeTestCaseResult[] = [];
    let passedTestCases = 0;
    let maxExecutionTime = 0;
    let status: SubmissionStatus = 'Accepted';
    let failureReason: string | undefined;
    let stopRunning = false;
    let stopReason: string | undefined;

    for (let testcaseIndex = 0; testcaseIndex < testcases.length; testcaseIndex += 1) {
      const testcase = testcases[testcaseIndex];
      const validationType = resolveTestcaseValidationType(testcase);
      const baseResult = {
        index: testcaseIndex + 1,
        isSample: Boolean(testcase.isSample),
        isHidden: Boolean(testcase.isHidden),
        input: testcase.input,
        validationType,
        ...(validationType === 'count_only'
          ? { expectedOutputCount: testcase.expectedOutputCount ?? 0 }
          : { expectedOutput: testcase.expectedOutput }),
      };

      if (stopRunning) {
        testCaseResults.push({
          ...baseResult,
          passed: false,
          status: 'skipped',
          executionTimeMs: 0,
          message: stopReason,
        });
        continue;
      }

      let input: Record<string, unknown>;
      try {
        input = normalizeJudgeInput(testcase.input);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invalid testcase input';
        testCaseResults.push({
          ...baseResult,
          passed: false,
          status: 'invalid_input',
          executionTimeMs: 0,
          message,
        });
        if (status === 'Accepted') {
          status = 'Runtime Error';
          failureReason = `Test case ${testcaseIndex + 1}: ${message}`;
        }
        continue;
      }

      const runResult = await this.codeRunner.run(language, code, input, {
        timeoutMs: timeLimitMs,
      });
      maxExecutionTime = Math.max(maxExecutionTime, runResult.executionTimeMs);

      if (!runResult.ok) {
        const caseStatus = this.mapErrorToCaseStatus(runResult.errorType);
        testCaseResults.push({
          ...baseResult,
          passed: false,
          status: caseStatus,
          executionTimeMs: runResult.executionTimeMs,
          message: runResult.message,
        });

        if (status === 'Accepted') {
          status = this.mapErrorToStatus(runResult.errorType);
          failureReason = `Test case ${testcaseIndex + 1}: ${runResult.message}`;
        }

        if (runResult.errorType === 'compilation') {
          stopRunning = true;
          stopReason = 'Skipped after compilation error';
        }

        continue;
      }

      const passed = compareTestcaseOutput(
        runResult.output,
        {
          validationType: testcase.validationType,
          expectedOutput: testcase.expectedOutput,
          expectedOutputCount: testcase.expectedOutputCount,
        },
        question.outputType,
        input,
      );

      if (!passed) {
        const message = `expected ${JSON.stringify(testcase.expectedOutput)}, got ${JSON.stringify(runResult.output)}`;
        testCaseResults.push({
          ...baseResult,
          actualOutput: runResult.output,
          passed: false,
          status: 'wrong_answer',
          executionTimeMs: runResult.executionTimeMs,
          message,
        });

        if (status === 'Accepted') {
          status = 'Wrong Answer';
          failureReason = `Test case ${testcaseIndex + 1}: ${message}`;
        }

        continue;
      }

      passedTestCases += 1;
      testCaseResults.push({
        ...baseResult,
        actualOutput: runResult.output,
        passed: true,
        status: 'passed',
        executionTimeMs: runResult.executionTimeMs,
      });
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
      testCases: testCaseResults,
    };
  }

  private mapErrorToCaseStatus(
    errorType: 'compilation' | 'runtime' | 'timeout',
  ): JudgeTestCaseResult['status'] {
    switch (errorType) {
      case 'compilation':
        return 'compilation_error';
      case 'timeout':
        return 'time_limit_exceeded';
      default:
        return 'runtime_error';
    }
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
