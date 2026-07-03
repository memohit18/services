import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  USER_PROGRESS_MODEL,
  USER_PROGRESS_STATUSES,
  UserProgressDocument,
  type UserProgressStatus,
} from '../../db-schema/mongodb/schemas/user-progress.schema';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityModule,
  type ActivityLogContext,
} from '../activity-logs/types/activity-log.types';
import { ListUserProgressQueryDto } from './dto/list-user-progress-query.dto';
import { UpdateUserProgressDto } from './dto/update-user-progress.dto';
import type { DailyActivityResponse } from './types/daily-activity-response.type';
import {
  defaultUserProgress,
  defaultQuestionUserProgress,
  type QuestionUserProgress,
  type UserProgressListResponse,
  type UserProgressResponse,
} from './types/user-progress-response.type';
import {
  currentMonthKeyUtc,
  getMonthBoundsUtc,
  listDaysInMonth,
  parseMonthKey,
} from './utils/month-calendar.util';
import {
  buildUserIdFilter,
  buildUserProgressWriteFilter,
  resolveAttemptCount,
  type SubmissionAttemptStats,
} from './utils/user-progress-attempts.util';

@Injectable()
export class UserProgressService {
  constructor(
    @InjectModel(USER_PROGRESS_MODEL)
    private readonly userProgressModel: Model<UserProgressDocument>,
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(SUBMISSION_MODEL)
    private readonly submissionModel: Model<SubmissionDocument>,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async getDailyActivity(
    userId: string,
    monthKey?: string,
  ): Promise<DailyActivityResponse> {
    const resolvedMonthKey = monthKey ?? currentMonthKeyUtc();
    const { year, month } = parseMonthKey(resolvedMonthKey);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be in YYYY-MM format');
    }

    const { start, end } = getMonthBoundsUtc(year, month);
    const daysInMonth = listDaysInMonth(year, month);

    const activeDayRows = await this.submissionModel.aggregate<{ _id: string }>([
      {
        $match: {
          ...buildUserIdFilter(userId),
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
        },
      },
    ]);

    const activeDays = new Set(activeDayRows.map((row) => row._id));
    const days = daysInMonth.map((date) => ({
      date,
      attempted: activeDays.has(date),
    }));

    return {
      year,
      month,
      monthKey: resolvedMonthKey,
      startDate: daysInMonth[0],
      endDate: daysInMonth[daysInMonth.length - 1],
      timezone: 'UTC',
      days,
      summary: {
        activeDays: days.filter((day) => day.attempted).length,
        totalDays: days.length,
      },
    };
  }

  async getProgressForQuestionIds(
    userId: string,
    questionIds: number[],
  ): Promise<Map<number, QuestionUserProgress>> {
    const uniqueQuestionIds = [...new Set(questionIds)];
    const result = new Map<number, QuestionUserProgress>();

    if (uniqueQuestionIds.length === 0) {
      return result;
    }

    const [progressDocs, submissionStats] = await Promise.all([
      this.userProgressModel
        .find({
          ...buildUserIdFilter(userId),
          questionId: { $in: uniqueQuestionIds },
        })
        .select('questionId status attempts confidence lastAttemptedAt')
        .lean(),
      this.aggregateSubmissionStats(userId, uniqueQuestionIds),
    ]);

    const progressByQuestionId = new Map(
      progressDocs.map((doc) => [doc.questionId, doc]),
    );
    const submissionsByQuestionId = new Map(
      submissionStats.map((stat) => [stat.questionId, stat]),
    );

    for (const questionId of uniqueQuestionIds) {
      const progress = progressByQuestionId.get(questionId);
      const submission = submissionsByQuestionId.get(questionId);
      const attempts = resolveAttemptCount(progress?.attempts, submission?.attempts);

      if (!progress && !submission) {
        result.set(questionId, defaultQuestionUserProgress());
        continue;
      }

      result.set(questionId, {
        status:
          progress?.status ??
          (attempts > 0 ? 'Attempted' : 'Not Started'),
        attempts,
        confidence: progress?.confidence ?? 1,
        lastAttemptedAt:
          progress?.lastAttemptedAt ?? submission?.lastAttemptedAt,
      });
    }

    return result;
  }

  async findAll(
    userId: string,
    query: ListUserProgressQueryDto,
  ): Promise<UserProgressListResponse> {
    const [progressDocs, submissionStats, filters] = await Promise.all([
      this.userProgressModel
        .find(buildUserIdFilter(userId))
        .sort({ updatedAt: -1 })
        .select('questionId')
        .lean(),
      this.aggregateSubmissionStats(userId),
      this.getFilterSummary(userId),
    ]);

    const questionIds = [
      ...new Set([
        ...progressDocs.map((doc) => doc.questionId),
        ...submissionStats.map((stat) => stat.questionId),
      ]),
    ];

    if (questionIds.length === 0) {
      return {
        items: [],
        meta: {
          total: 0,
          appliedFilters: {
            ...(query.status ? { status: query.status } : {}),
          },
        },
        filters,
      };
    }

    const progressByQuestionId = await this.getProgressForQuestionIds(
      userId,
      questionIds,
    );

    let items: UserProgressResponse[] = questionIds.map((questionId) => {
      const progress =
        progressByQuestionId.get(questionId) ?? defaultQuestionUserProgress();

      return {
        questionId,
        status: progress.status,
        attempts: progress.attempts,
        confidence: progress.confidence,
        lastAttemptedAt: progress.lastAttemptedAt,
      };
    });

    items.sort((left, right) => {
      const leftTime = left.lastAttemptedAt?.getTime() ?? 0;
      const rightTime = right.lastAttemptedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }

    const enrichedItems = await this.enrichWithQuestionMetadata(items);

    return {
      items: enrichedItems,
      meta: {
        total: enrichedItems.length,
        appliedFilters: {
          ...(query.status ? { status: query.status } : {}),
        },
      },
      filters,
    };
  }

  async findOne(
    userId: string,
    questionId: number,
  ): Promise<UserProgressResponse> {
    await this.ensureQuestionExists(questionId);

    const progress = await this.userProgressModel
      .findOne({
        ...buildUserIdFilter(userId),
        questionId,
      })
      .select('-__v')
      .lean();

    if (!progress) {
      const [submissionStats] = await this.aggregateSubmissionStats(userId, [
        questionId,
      ]);
      if (!submissionStats) {
        return defaultUserProgress(questionId);
      }

      return {
        questionId,
        status: 'Attempted',
        attempts: submissionStats.attempts,
        confidence: 1,
        lastAttemptedAt: submissionStats.lastAttemptedAt,
      };
    }

    const [enriched] = await this.enrichWithQuestionMetadata([progress]);
    const [synced] = await this.syncAttemptsFromSubmissions(userId, [enriched]);
    return synced;
  }

  async update(
    userId: string,
    questionId: number,
    dto: UpdateUserProgressDto,
    context?: ActivityLogContext,
  ): Promise<UserProgressResponse> {
    await this.ensureQuestionExists(questionId);

    const update: Record<string, unknown> = {};

    if (dto.status !== undefined) {
      update.status = dto.status;
    }

    if (dto.confidence !== undefined) {
      update.confidence = dto.confidence;
    }

    if (dto.nextRevisionDate !== undefined) {
      update.nextRevisionDate = dto.nextRevisionDate;
    }

    const progress = await this.userProgressModel
      .findOneAndUpdate(
        buildUserProgressWriteFilter(userId, questionId),
        { $set: { ...update, userId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .select('-__v')
      .lean();

    const [enriched] = await this.enrichWithQuestionMetadata([progress]);
    const [synced] = await this.syncAttemptsFromSubmissions(userId, [enriched]);

    if (context?.userId) {
      await this.activityLogsService.log({
        ...context,
        module: ActivityModule.USER_PROGRESS,
        action: ActivityAction.UPDATE,
        payload: {
          questionId,
          status: enriched.status,
          confidence: enriched.confidence,
          nextRevisionDate: enriched.nextRevisionDate,
        },
      });
    }

    return synced;
  }

  async recordSubmissionAttempt(
    userId: string,
    questionId: number,
    submissionStatus?: string,
  ) {
    const existing = await this.userProgressModel
      .findOne({
        ...buildUserIdFilter(userId),
        questionId,
      })
      .select('_id status')
      .lean();

    const status = this.resolveStatusAfterSubmission(
      existing?.status,
      submissionStatus,
    );

    const writeFilter = existing?._id
      ? { _id: existing._id }
      : buildUserProgressWriteFilter(userId, questionId);

    await this.userProgressModel.findOneAndUpdate(
      writeFilter,
      {
        $set: {
          userId,
          questionId,
          status,
          lastAttemptedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  private async aggregateSubmissionStats(
    userId: string,
    questionIds?: number[],
  ): Promise<SubmissionAttemptStats[]> {
    const match: Record<string, unknown> = {
      ...buildUserIdFilter(userId),
    };

    if (questionIds?.length) {
      match.questionId = { $in: questionIds };
    }

    return this.submissionModel.aggregate<SubmissionAttemptStats>([
      { $match: match },
      {
        $group: {
          _id: '$questionId',
          attempts: { $sum: 1 },
          lastAttemptedAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          attempts: 1,
          lastAttemptedAt: 1,
        },
      },
    ]);
  }

  private async syncAttemptsFromSubmissions(
    userId: string,
    items: UserProgressResponse[],
  ): Promise<UserProgressResponse[]> {
    if (items.length === 0) {
      return items;
    }

    const submissionStats = await this.aggregateSubmissionStats(
      userId,
      items.map((item) => item.questionId),
    );
    const submissionsByQuestionId = new Map(
      submissionStats.map((stat) => [stat.questionId, stat]),
    );

    return items.map((item) => {
      const submission = submissionsByQuestionId.get(item.questionId);
      const attempts = resolveAttemptCount(item.attempts, submission?.attempts);

      return {
        ...item,
        attempts,
        lastAttemptedAt: item.lastAttemptedAt ?? submission?.lastAttemptedAt,
      };
    });
  }

  async getFilterSummary(userId: string) {
    const [totalQuestions, progressDocs, submissionStats] = await Promise.all([
      this.questionModel.countDocuments(),
      this.userProgressModel
        .find(buildUserIdFilter(userId))
        .select('questionId')
        .lean(),
      this.aggregateSubmissionStats(userId),
    ]);

    const trackedQuestionIds = [
      ...new Set([
        ...progressDocs.map((doc) => doc.questionId),
        ...submissionStats.map((stat) => stat.questionId),
      ]),
    ];

    const countsByStatus: Record<string, number> = {};
    for (const status of USER_PROGRESS_STATUSES) {
      countsByStatus[status] = 0;
    }

    if (trackedQuestionIds.length > 0) {
      const progressByQuestionId = await this.getProgressForQuestionIds(
        userId,
        trackedQuestionIds,
      );

      for (const progress of progressByQuestionId.values()) {
        if (progress.status === 'Not Started') {
          continue;
        }
        countsByStatus[progress.status] =
          (countsByStatus[progress.status] ?? 0) + 1;
      }
    }

    countsByStatus['Not Started'] = Math.max(
      0,
      totalQuestions - trackedQuestionIds.length,
    );

    return {
      statuses: [...USER_PROGRESS_STATUSES],
      countsByStatus,
      totalQuestions,
    };
  }

  private resolveStatusAfterSubmission(
    current: UserProgressStatus | undefined,
    submissionStatus?: string,
  ): UserProgressStatus {
    if (submissionStatus === 'Accepted') {
      return 'Solved';
    }

    if (!current || current === 'Not Started') {
      return 'Attempted';
    }

    return current;
  }

  private async enrichWithQuestionMetadata(
    items: Array<{
      questionId: number;
      status: UserProgressStatus;
      attempts?: number;
      confidence?: number;
      lastAttemptedAt?: Date;
      nextRevisionDate?: Date;
      createdAt?: Date;
      updatedAt?: Date;
    }>,
  ): Promise<UserProgressResponse[]> {
    if (items.length === 0) {
      return [];
    }

    const questionIds = items.map((item) => item.questionId);
    const questions = await this.questionModel
      .find({ questionId: { $in: questionIds } })
      .select('questionId title difficulty category')
      .lean();

    const questionById = new Map(
      questions.map((question) => [question.questionId, question]),
    );

    return items.map((item) => {
      const question = questionById.get(item.questionId);

      return {
        questionId: item.questionId,
        status: item.status,
        attempts: item.attempts ?? 0,
        confidence: item.confidence ?? 1,
        lastAttemptedAt: item.lastAttemptedAt,
        nextRevisionDate: item.nextRevisionDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(question
          ? {
              question: {
                title: question.title,
                difficulty: question.difficulty,
                category: question.category,
              },
            }
          : {}),
      };
    });
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
}
