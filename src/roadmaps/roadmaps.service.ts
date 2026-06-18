import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  ROADMAP_MODEL,
  RoadmapDocument,
} from '../../db-schema/mongodb/schemas/roadmap.schema';
import {
  ROADMAP_QUESTION_MODEL,
  RoadmapQuestionDocument,
} from '../../db-schema/mongodb/schemas/roadmap-question.schema';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityModule,
  type ActivityLogContext,
} from '../activity-logs/types/activity-log.types';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { ListRoadmapsQueryDto } from './dto/list-roadmaps-query.dto';
import type {
  RoadmapDetailResponse,
  RoadmapFilterContext,
  RoadmapFilterSummary,
  RoadmapListResponse,
} from './types/roadmap-response.type';

export type ResolveRoadmapFilterInput = {
  roadmapId?: string;
  roadmap?: string;
  useActiveRoadmap?: boolean;
};

@Injectable()
export class RoadmapsService {
  constructor(
    @InjectModel(ROADMAP_MODEL)
    private readonly roadmapModel: Model<RoadmapDocument>,
    @InjectModel(ROADMAP_QUESTION_MODEL)
    private readonly roadmapQuestionModel: Model<RoadmapQuestionDocument>,
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(
    userId: string,
    dto: CreateRoadmapDto,
    context?: ActivityLogContext,
  ): Promise<RoadmapDetailResponse> {
    this.validateQuestionOrders(dto.questions);

    const questionIds = dto.questions.map((item) => item.questionId);
    await this.ensureQuestionsExist(questionIds);

    const existing = await this.roadmapModel
      .findOne({ userId, slug: dto.slug })
      .select('_id')
      .lean();

    if (existing) {
      throw new ConflictException(`Roadmap slug "${dto.slug}" already exists`);
    }

    if (dto.isActive) {
      await this.deactivateUserRoadmaps(userId);
    }

    const roadmap = await this.roadmapModel.create({
      userId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      isActive: false,
      questionCount: dto.questions.length,
    });

    await this.roadmapQuestionModel.insertMany(
      dto.questions.map((item) => ({
        userId,
        roadmapId: roadmap._id,
        questionId: item.questionId,
        order: item.order,
      })),
    );

    if (dto.isActive) {
      await this.setActiveRoadmapForUser(userId, roadmap._id);
    }

    const formatted = await this.formatRoadmapDetail(
      (await this.roadmapModel.findById(roadmap._id).lean()) ?? roadmap,
    );

    if (context?.userId) {
      await this.activityLogsService.log({
        ...context,
        module: ActivityModule.ROADMAPS,
        action: ActivityAction.CREATE,
        payload: {
          roadmapId: formatted.roadmapId,
          slug: formatted.slug,
          name: formatted.name,
          isActive: formatted.isActive,
          questionCount: formatted.questionCount,
        },
      });
    }

    return formatted;
  }

  async activate(
    userId: string,
    roadmapId: string,
    context?: ActivityLogContext,
  ): Promise<RoadmapDetailResponse> {
    if (!Types.ObjectId.isValid(roadmapId)) {
      throw new NotFoundException(`Roadmap ${roadmapId} not found`);
    }

    const roadmap = await this.roadmapModel
      .findOne({ _id: roadmapId, userId })
      .lean();

    if (!roadmap) {
      throw new NotFoundException(`Roadmap ${roadmapId} not found`);
    }

    await this.setActiveRoadmapForUser(userId, roadmap._id);

    const updated = await this.roadmapModel.findById(roadmap._id).lean();

    if (!updated) {
      throw new NotFoundException(`Roadmap ${roadmapId} not found`);
    }

    const formatted = await this.formatRoadmapDetail(updated);

    if (context?.userId) {
      await this.activityLogsService.log({
        ...context,
        module: ActivityModule.ROADMAPS,
        action: ActivityAction.UPDATE,
        payload: {
          roadmapId: formatted.roadmapId,
          slug: formatted.slug,
          name: formatted.name,
          isActive: true,
          questionCount: formatted.questionCount,
          action: 'activate',
        },
      });
    }

    return formatted;
  }

  async findAll(
    userId: string,
    query: ListRoadmapsQueryDto,
  ): Promise<RoadmapListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = { userId };

    const [items, total] = await Promise.all([
      this.roadmapModel
        .find(filter)
        .sort({ isActive: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      this.roadmapModel.countDocuments(filter),
    ]);

    return {
      items: items.map((roadmap) => this.formatRoadmapListItem(roadmap)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getFilterSummary(userId: string): Promise<RoadmapFilterSummary> {
    const roadmaps = await this.roadmapModel
      .find({ userId })
      .sort({ isActive: -1, name: 1 })
      .select('name slug isActive questionCount')
      .lean();

    const activeRoadmap = roadmaps.find((roadmap) => roadmap.isActive);

    return {
      roadmaps: roadmaps.map((roadmap) => ({
        roadmapId: roadmap._id.toString(),
        name: roadmap.name,
        slug: roadmap.slug,
        isActive: roadmap.isActive,
        questionCount: roadmap.questionCount,
      })),
      activeRoadmapId: activeRoadmap?._id.toString(),
    };
  }

  async resolveRoadmapFilter(
    userId: string,
    input: ResolveRoadmapFilterInput,
  ): Promise<RoadmapFilterContext | null> {
    const hasRoadmapFilter =
      Boolean(input.roadmapId) ||
      Boolean(input.roadmap) ||
      Boolean(input.useActiveRoadmap);

    if (!hasRoadmapFilter) {
      return null;
    }

    let roadmap: {
      _id: Types.ObjectId;
      slug: string;
      name: string;
      isActive: boolean;
    } | null = null;

    if (input.roadmapId) {
      if (!Types.ObjectId.isValid(input.roadmapId)) {
        throw new NotFoundException(`Roadmap ${input.roadmapId} not found`);
      }

      roadmap = await this.roadmapModel
        .findOne({ _id: input.roadmapId, userId })
        .select('slug name isActive')
        .lean();
    } else if (input.roadmap) {
      roadmap = await this.roadmapModel
        .findOne({ userId, slug: input.roadmap })
        .select('slug name isActive')
        .lean();
    } else if (input.useActiveRoadmap) {
      roadmap = await this.roadmapModel
        .findOne({ userId, isActive: true })
        .select('slug name isActive')
        .lean();
    }

    if (!roadmap) {
      throw new NotFoundException('Roadmap not found for the current user');
    }

    const roadmapQuestions = await this.roadmapQuestionModel
      .find({ roadmapId: roadmap._id, userId })
      .sort({ order: 1 })
      .select('questionId order')
      .lean();

    return {
      roadmapId: roadmap._id.toString(),
      slug: roadmap.slug,
      name: roadmap.name,
      isActive: roadmap.isActive,
      orderedQuestionIds: roadmapQuestions.map((item) => item.questionId),
    };
  }

  async getRoadmapOrderMap(
    userId: string,
    roadmapId: string,
  ): Promise<Map<number, number>> {
    if (!Types.ObjectId.isValid(roadmapId)) {
      return new Map();
    }

    const roadmapQuestions = await this.roadmapQuestionModel
      .find({ roadmapId, userId })
      .sort({ order: 1 })
      .select('questionId order')
      .lean();

    return new Map(
      roadmapQuestions.map((item) => [item.questionId, item.order]),
    );
  }

  private validateQuestionOrders(
    questions: CreateRoadmapDto['questions'],
  ) {
    const orders = new Set<number>();
    const questionIds = new Set<number>();

    for (const item of questions) {
      if (orders.has(item.order)) {
        throw new BadRequestException(
          `Duplicate order ${item.order} in roadmap questions`,
        );
      }

      if (questionIds.has(item.questionId)) {
        throw new BadRequestException(
          `Duplicate questionId ${item.questionId} in roadmap questions`,
        );
      }

      orders.add(item.order);
      questionIds.add(item.questionId);
    }
  }

  private async ensureQuestionsExist(questionIds: number[]) {
    const existingCount = await this.questionModel.countDocuments({
      questionId: { $in: questionIds },
    });

    if (existingCount !== questionIds.length) {
      throw new BadRequestException(
        'One or more questionIds do not exist in questions collection',
      );
    }
  }

  private async setActiveRoadmapForUser(
    userId: string,
    roadmapId: Types.ObjectId,
  ) {
    await this.roadmapModel.bulkWrite([
      {
        updateMany: {
          filter: {
            userId,
            isActive: true,
            _id: { $ne: roadmapId },
          },
          update: { $set: { isActive: false } },
        },
      },
      {
        updateOne: {
          filter: { _id: roadmapId, userId },
          update: { $set: { isActive: true } },
        },
      },
    ]);
  }

  private async deactivateUserRoadmaps(userId: string) {
    await this.roadmapModel.updateMany(
      { userId, isActive: true },
      { $set: { isActive: false } },
    );
  }

  private async formatRoadmapDetail(
    roadmap: RoadmapDocument | { _id: Types.ObjectId; userId: string | number; name: string; slug: string; description?: string; isActive: boolean; questionCount: number; createdAt?: Date; updatedAt?: Date },
  ): Promise<RoadmapDetailResponse> {
    const roadmapQuestions = await this.roadmapQuestionModel
      .find({ roadmapId: roadmap._id })
      .sort({ order: 1 })
      .select('questionId order')
      .lean();

    const questionTitles = await this.questionModel
      .find({
        questionId: {
          $in: roadmapQuestions.map((item) => item.questionId),
        },
      })
      .select('questionId title')
      .lean();

    const titleByQuestionId = new Map(
      questionTitles.map((question) => [question.questionId, question.title]),
    );

    return {
      ...this.formatRoadmapListItem(roadmap),
      questions: roadmapQuestions.map((item) => ({
        questionId: item.questionId,
        order: item.order,
        title: titleByQuestionId.get(item.questionId),
      })),
    };
  }

  private formatRoadmapListItem(roadmap: {
    _id: { toString(): string };
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
    questionCount: number;
  }) {
    return {
      roadmapId: roadmap._id.toString(),
      name: roadmap.name,
      slug: roadmap.slug,
      description: roadmap.description,
      isActive: roadmap.isActive,
      questionCount: roadmap.questionCount,
    };
  }
}
