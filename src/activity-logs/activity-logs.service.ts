import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ACTIVITY_LOG_MODEL,
  ActivityLogDocument,
} from '../../db-schema/mongodb/schemas/activity-log.schema';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';
import type {
  ActivityLogFilterSummary,
  ActivityLogListResponse,
  ActivityLogResponse,
  CreateActivityLogInput,
} from './types/activity-log.types';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectModel(ACTIVITY_LOG_MODEL)
    private readonly activityLogModel: Model<ActivityLogDocument>,
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

    return {
      items: items.map((item) => this.formatActivityLog(item)),
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

    return this.formatActivityLog(log);
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
