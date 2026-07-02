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
  type UserProgressListResponse,
  type UserProgressResponse,
} from './types/user-progress-response.type';
import {
  currentMonthKeyUtc,
  getMonthBoundsUtc,
  listDaysInMonth,
  parseMonthKey,
} from './utils/month-calendar.util';

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
          userId,
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

  async findAll(
    userId: string,
    query: ListUserProgressQueryDto,
  ): Promise<UserProgressListResponse> {
    const filter: Record<string, unknown> = { userId };

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total, filters] = await Promise.all([
      this.userProgressModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .select('-__v')
        .lean(),
      this.userProgressModel.countDocuments(filter),
      this.getFilterSummary(userId),
    ]);

    const enrichedItems = await this.enrichWithQuestionMetadata(items);

    return {
      items: enrichedItems,
      meta: {
        total,
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
      .findOne({ userId, questionId })
      .select('-__v')
      .lean();

    if (!progress) {
      return defaultUserProgress(questionId);
    }

    const [enriched] = await this.enrichWithQuestionMetadata([progress]);
    return enriched;
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
        { userId, questionId },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .select('-__v')
      .lean();

    const [enriched] = await this.enrichWithQuestionMetadata([progress]);

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

    return enriched;
  }

  async recordSubmissionAttempt(
    userId: string,
    questionId: number,
    submissionStatus?: string,
  ) {
    const existing = await this.userProgressModel
      .findOne({ userId, questionId })
      .select('status')
      .lean();

    const status = this.resolveStatusAfterSubmission(
      existing?.status,
      submissionStatus,
    );

    await this.userProgressModel.findOneAndUpdate(
      { userId, questionId },
      {
        $set: {
          status,
          lastAttemptedAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async getFilterSummary(userId: string) {
    const counts = await this.userProgressModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const countsByStatus: Record<string, number> = {};
    for (const status of USER_PROGRESS_STATUSES) {
      countsByStatus[status] = 0;
    }

    for (const entry of counts) {
      countsByStatus[entry._id] = entry.count;
    }

    return {
      statuses: [...USER_PROGRESS_STATUSES],
      countsByStatus,
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
