import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  SUBMISSION_MODEL,
  SubmissionDocument,
} from '../../db-schema/mongodb/schemas/submission.schema';
import {
  TEST_CASE_MODEL,
  TestCaseDocument,
} from '../../db-schema/mongodb/schemas/test-case.schema';
import { getQuestionJudgingContext } from '../common/utils/question-judging-context.util';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { CodeJudgeService } from './judging/code-judge.service';
import type {
  SubmissionCreateResponse,
  SubmissionListResponse,
  SubmissionQuestionContext,
  SubmissionResponse,
} from './types/submission-response.type';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityModule,
  type ActivityLogContext,
} from '../activity-logs/types/activity-log.types';
import { UserProgressService } from '../user-progress/user-progress.service';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(SUBMISSION_MODEL)
    private readonly submissionModel: Model<SubmissionDocument>,
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
    private readonly activityLogsService: ActivityLogsService,
    private readonly userProgressService: UserProgressService,
    private readonly codeJudgeService: CodeJudgeService,
  ) {}

  async create(
    questionId: number,
    userId: string,
    dto: CreateSubmissionDto,
    context?: ActivityLogContext,
  ): Promise<SubmissionCreateResponse> {
    const questionContext = await this.getQuestionContext(questionId);

    const judgeResult = await this.codeJudgeService.judgeSubmission(
      questionId,
      dto.language,
      dto.code,
    );

    const submission = await this.submissionModel.create({
      userId,
      questionId,
      language: dto.language,
      code: dto.code,
      status: judgeResult.status,
      passedTestCases: judgeResult.passedTestCases,
      totalTestCases: judgeResult.totalTestCases,
      executionTime: judgeResult.executionTime,
      memoryUsed: judgeResult.memoryUsed,
    });

    const formatted = this.formatSubmission(submission);

    await this.userProgressService.recordSubmissionAttempt(
      userId,
      questionId,
      judgeResult.status,
    );

    if (context?.userId) {
      await this.activityLogsService.log({
        ...context,
        module: ActivityModule.SUBMISSIONS,
        action: ActivityAction.CREATE,
        payload: this.buildSubmissionActivityPayload(
          formatted,
          questionContext,
          dto.code.length,
        ),
      });
    }

    return {
      ...formatted,
      question: questionContext,
      ...(judgeResult.failureReason
        ? { failureReason: judgeResult.failureReason }
        : {}),
    };
  }

  async findAllForQuestion(
    questionId: number,
    userId: string,
    query: ListSubmissionsQueryDto,
  ): Promise<SubmissionListResponse> {
    const questionContext = await this.getQuestionContext(questionId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = { questionId, userId };

    const [items, total] = await Promise.all([
      this.submissionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      this.submissionModel.countDocuments(filter),
    ]);

    return {
      items: items.map((submission) => this.formatSubmission(submission)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        questionId,
      },
      question: questionContext,
    };
  }

  private async getQuestionContext(
    questionId: number,
  ): Promise<SubmissionQuestionContext> {
    const questionContext = await getQuestionJudgingContext(
      this.questionModel,
      this.testCaseModel,
      questionId,
    );

    if (!questionContext) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    return questionContext;
  }

  private buildSubmissionActivityPayload(
    submission: SubmissionResponse,
    questionContext: SubmissionQuestionContext,
    codeLength: number,
  ) {
    return {
      submissionId: submission.submissionId,
      questionId: submission.questionId,
      language: submission.language,
      status: submission.status,
      passedTestCases: submission.passedTestCases,
      totalTestCases: submission.totalTestCases,
      executionTime: submission.executionTime,
      memoryUsed: submission.memoryUsed,
      codeLength,
      outputType: questionContext.outputType,
      timeLimitMs: questionContext.timeLimitMs,
      judging: questionContext.judging,
      testcaseSummary: questionContext.testcaseSummary,
    };
  }

  private formatSubmission(submission: {
    _id: { toString(): string };
    userId: string | number;
    questionId: number;
    language: string;
    code: string;
    status?: SubmissionResponse['status'];
    passedTestCases?: number;
    totalTestCases?: number;
    executionTime?: number;
    memoryUsed?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): SubmissionResponse {
    return {
      submissionId: submission._id.toString(),
      userId: String(submission.userId),
      questionId: submission.questionId,
      language: submission.language,
      code: submission.code,
      status: submission.status ?? 'Runtime Error',
      passedTestCases: submission.passedTestCases ?? 0,
      totalTestCases: submission.totalTestCases ?? 0,
      executionTime: submission.executionTime,
      memoryUsed: submission.memoryUsed,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }
}
