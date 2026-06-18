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
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import type {
  SubmissionListResponse,
  SubmissionResponse,
} from './types/submission-response.type';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(SUBMISSION_MODEL)
    private readonly submissionModel: Model<SubmissionDocument>,
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
  ) {}

  async create(
    questionId: number,
    userId: string,
    dto: CreateSubmissionDto,
  ): Promise<SubmissionResponse> {
    await this.ensureQuestionExists(questionId);

    const totalTestCases =
      dto.totalTestCases ??
      (await this.testCaseModel.countDocuments({ questionId }));

    const submission = await this.submissionModel.create({
      userId,
      questionId,
      language: dto.language,
      code: dto.code,
      status: dto.status,
      passedTestCases: dto.passedTestCases ?? 0,
      totalTestCases,
      executionTime: dto.executionTime,
      memoryUsed: dto.memoryUsed,
    });

    return this.formatSubmission(submission);
  }

  async findAllForQuestion(
    questionId: number,
    userId: string,
    query: ListSubmissionsQueryDto,
  ): Promise<SubmissionListResponse> {
    await this.ensureQuestionExists(questionId);

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
    };
  }

  private async ensureQuestionExists(questionId: number) {
    const question = await this.questionModel
      .findOne({ questionId })
      .select('_id')
      .lean();

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }
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
      status: submission.status,
      passedTestCases: submission.passedTestCases ?? 0,
      totalTestCases: submission.totalTestCases ?? 0,
      executionTime: submission.executionTime,
      memoryUsed: submission.memoryUsed,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }
}
