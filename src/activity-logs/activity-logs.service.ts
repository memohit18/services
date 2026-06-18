import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ACTIVITY_LOG_MODEL,
  ActivityLogDocument,
} from '../../db-schema/mongodb/schemas/activity-log.schema';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  TEST_CASE_MODEL,
  TestCaseDocument,
} from '../../db-schema/mongodb/schemas/test-case.schema';
import { getQuestionJudgingContextsByQuestionIds } from '../common/utils/question-judging-context.util';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';
import {
  ActivityAction,
  ActivityModule,
  type ActivityLogFilterSummary,
  type ActivityLogListResponse,
  type ActivityLogResponse,
  type CreateActivityLogInput,
} from './types/activity-log.types';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectModel(ACTIVITY_LOG_MODEL)
    private readonly activityLogModel: Model<ActivityLogDocument>,
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
  ) {}

  async log(input: CreateActivityLogInput): Promise<ActivityLogResponse> {
    const entry = await this.activityLogModel.create({
      userId: input.userId,
      action: input.action,
      module: input.module,
      payload: input.payload ?? {},
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return this.formatActivityLog(entry);
  }

  async findAll(
    userId: string,
    query: ListActivityLogsQueryDto,
  ): Promise<ActivityLogListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { userId };

    if (query.module) {
      filter.module = query.module;
    }

    if (query.action) {
      filter.action = query.action;
    }

    const [items, total, filters] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      this.activityLogModel.countDocuments(filter),
      this.getFilterOptions(userId),
    ]);

    const formattedItems = await this.enrichSubmissionLogs(
      items.map((item) => this.formatActivityLog(item)),
    );

    return {
      items: formattedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        appliedFilters: {
          ...(query.module ? { module: query.module } : {}),
          ...(query.action ? { action: query.action } : {}),
        },
      },
      filters,
    };
  }

  async findOne(
    userId: string,
    activityLogId: string,
  ): Promise<ActivityLogResponse> {
    if (!Types.ObjectId.isValid(activityLogId)) {
      throw new NotFoundException(`Activity log ${activityLogId} not found`);
    }

    const log = await this.activityLogModel
      .findOne({ _id: activityLogId, userId })
      .select('-__v')
      .lean();

    if (!log) {
      throw new NotFoundException(`Activity log ${activityLogId} not found`);
    }

    const [formatted] = await this.enrichSubmissionLogs([
      this.formatActivityLog(log),
    ]);

    return formatted;
  }

  async getFilterOptions(userId: string): Promise<ActivityLogFilterSummary> {
    const baseFilter = { userId };

    const [modules, actions, moduleCounts, actionCounts] = await Promise.all([
      this.activityLogModel.distinct('module', baseFilter).exec(),
      this.activityLogModel.distinct('action', baseFilter).exec(),
      this.activityLogModel.aggregate<{ _id: string; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$module', count: { $sum: 1 } } },
      ]),
      this.activityLogModel.aggregate<{ _id: string; count: number }>([
        { $match: baseFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]),
    ]);

    const countsByModule: Record<string, number> = {};
    const countsByAction: Record<string, number> = {};

    for (const entry of moduleCounts) {
      countsByModule[entry._id] = entry.count;
    }

    for (const entry of actionCounts) {
      countsByAction[entry._id] = entry.count;
    }

    return {
      modules: modules.sort((a, b) => a.localeCompare(b)),
      actions: actions.sort((a, b) => a.localeCompare(b)),
      countsByModule,
      countsByAction,
    };
  }

  private async enrichSubmissionLogs(
    items: ActivityLogResponse[],
  ): Promise<ActivityLogResponse[]> {
    const questionIds = new Set<number>();

    for (const item of items) {
      if (!this.isSubmissionCreateLog(item)) {
        continue;
      }

      const questionId = this.getPayloadQuestionId(item.payload);
      if (questionId !== undefined && !item.payload.judging) {
        questionIds.add(questionId);
      }
    }

    if (!questionIds.size) {
      return items;
    }

    const contexts = await getQuestionJudgingContextsByQuestionIds(
      this.questionModel,
      this.testCaseModel,
      [...questionIds],
    );

    return items.map((item) => {
      if (!this.isSubmissionCreateLog(item) || item.payload.judging) {
        return item;
      }

      const questionId = this.getPayloadQuestionId(item.payload);
      if (questionId === undefined) {
        return item;
      }

      const context = contexts.get(questionId);
      if (!context) {
        return item;
      }

      return {
        ...item,
        payload: {
          ...item.payload,
          outputType: context.outputType,
          judging: context.judging,
          testcaseSummary: context.testcaseSummary,
        },
      };
    });
  }

  private isSubmissionCreateLog(item: ActivityLogResponse) {
    return (
      item.module === ActivityModule.SUBMISSIONS &&
      item.action === ActivityAction.CREATE
    );
  }

  private getPayloadQuestionId(payload: Record<string, unknown>) {
    const questionId = payload.questionId;

    if (typeof questionId === 'number') {
      return questionId;
    }

    if (typeof questionId === 'string' && questionId.trim()) {
      const parsed = Number(questionId);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private formatActivityLog(log: {
    _id: { toString(): string };
    userId?: string;
    action: string;
    module: string;
    payload?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): ActivityLogResponse {
    return {
      activityLogId: log._id.toString(),
      userId: log.userId,
      action: log.action,
      module: log.module,
      payload: log.payload ?? {},
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  }
}
