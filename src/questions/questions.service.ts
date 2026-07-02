import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EXAMPLE_MODEL,
  ExampleDocument,
} from '../../db-schema/mongodb/schemas/example.schema';
import {
  FOLLOW_UP_MODEL,
  FollowUpDocument,
} from '../../db-schema/mongodb/schemas/follow-up.schema';
import {
  HINT_MODEL,
  HintDocument,
} from '../../db-schema/mongodb/schemas/hint.schema';
import { DEFAULT_QUESTION_TIME_LIMIT_MS } from '../../db-schema/mongodb/constants/question.constants';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  TEST_CASE_MODEL,
  TestCaseDocument,
} from '../../db-schema/mongodb/schemas/test-case.schema';
import {
  BulkUploadQuestionsDto,
  QuestionItemDto,
} from './dto/bulk-upload-questions.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { getTestcaseSummaryByQuestionIds } from '../common/utils/testcase-summary.util';
import {
  buildJudgingInfo,
  emptyTestcaseCounts,
  emptyTestcaseSummary,
  formatTestcaseResponse,
  type QuestionDetailResponse,
  type QuestionExampleResponse,
  type QuestionListItemResponse,
  type TestcaseCounts,
} from './types/question-response.type';
import type {
  QuestionFiltersResponse,
  QuestionListAppliedFilters,
  QuestionListResponse,
} from './types/question-filters-response.type';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityModule,
  type ActivityLogContext,
} from '../activity-logs/types/activity-log.types';
import { RoadmapsService } from '../roadmaps/roadmaps.service';
import { UserProgressService } from '../user-progress/user-progress.service';
import type { QuestionListItemWithRoadmap } from './types/question-filters-response.type';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(EXAMPLE_MODEL)
    private readonly exampleModel: Model<ExampleDocument>,
    @InjectModel(HINT_MODEL)
    private readonly hintModel: Model<HintDocument>,
    @InjectModel(FOLLOW_UP_MODEL)
    private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
    private readonly activityLogsService: ActivityLogsService,
    private readonly roadmapsService: RoadmapsService,
    private readonly userProgressService: UserProgressService,
  ) {}

  async findAll(
    query: ListQuestionsQueryDto,
    userId: string,
  ): Promise<QuestionListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const roadmapContext = await this.roadmapsService.resolveRoadmapFilter(
      userId,
      {
        roadmapId: query.roadmapId,
        roadmap: query.roadmap,
        useActiveRoadmap: query.useActiveRoadmap,
      },
    );

    if (roadmapContext) {
      return this.findAllForRoadmap(query, userId, roadmapContext, page, limit);
    }

    const filter = this.buildQuestionFilter(query);

    const [items, total, filters] = await Promise.all([
      this.questionModel
        .find(filter)
        .sort({ questionId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      this.questionModel.countDocuments(filter),
      this.getFilters(),
    ]);

    const enrichedItems = await this.buildQuestionListResponse(items, userId);

    return {
      items: enrichedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        appliedFilters: this.buildAppliedFilters(query),
      },
      filters,
    };
  }

  private async findAllForRoadmap(
    query: ListQuestionsQueryDto,
    userId: string,
    roadmapContext: NonNullable<
      Awaited<ReturnType<RoadmapsService['resolveRoadmapFilter']>>
    >,
    page: number,
    limit: number,
  ): Promise<QuestionListResponse> {
    const filter = this.buildQuestionFilter(query);

    if (roadmapContext.orderedQuestionIds.length === 0) {
      return {
        items: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          appliedFilters: this.buildAppliedFilters(query),
          roadmap: {
            roadmapId: roadmapContext.roadmapId,
            slug: roadmapContext.slug,
            name: roadmapContext.name,
            isActive: roadmapContext.isActive,
          },
        },
        filters: await this.getFilters(),
      };
    }

    filter.questionId = { $in: roadmapContext.orderedQuestionIds };

    const [allMatching, filters, orderMap] = await Promise.all([
      this.questionModel.find(filter).select('-__v').lean(),
      this.getFilters(),
      this.roadmapsService.getRoadmapOrderMap(
        userId,
        roadmapContext.roadmapId,
      ),
    ]);

    const orderIndex = new Map(
      roadmapContext.orderedQuestionIds.map((questionId, index) => [
        questionId,
        index,
      ]),
    );

    allMatching.sort(
      (left, right) =>
        (orderIndex.get(left.questionId) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(right.questionId) ?? Number.MAX_SAFE_INTEGER),
    );

    const total = allMatching.length;
    const pagedItems = allMatching.slice((page - 1) * limit, page * limit);
    const enrichedItems = await this.buildQuestionListResponse(pagedItems, userId);

    const itemsWithRoadmap: QuestionListItemWithRoadmap[] =
      enrichedItems.map((item) => ({
        ...item,
        roadmap: {
          roadmapId: roadmapContext.roadmapId,
          slug: roadmapContext.slug,
          name: roadmapContext.name,
          order: orderMap.get(item.questionId) ?? 0,
        },
      }));

    return {
      items: itemsWithRoadmap,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        appliedFilters: this.buildAppliedFilters(query),
        roadmap: {
          roadmapId: roadmapContext.roadmapId,
          slug: roadmapContext.slug,
          name: roadmapContext.name,
          isActive: roadmapContext.isActive,
        },
      },
      filters,
    };
  }

  async getFilters(): Promise<QuestionFiltersResponse> {
    const [categories, tags, difficulties] = await Promise.all([
      this.questionModel.distinct('category').exec(),
      this.questionModel.distinct('tags').exec(),
      this.questionModel.distinct('difficulty').exec(),
    ]);

    return {
      categories: categories.sort((a, b) => a.localeCompare(b)),
      tags: tags.sort((a, b) => a.localeCompare(b)),
      difficulties: difficulties.sort((a, b) => a.localeCompare(b)),
    };
  }

  async findOne(questionId: number): Promise<QuestionDetailResponse> {
    const question = await this.questionModel
      .findOne({ questionId })
      .select('-__v')
      .lean<QuestionSourceDocument>();

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const [
      examplesByQuestionId,
      hintsByQuestionId,
      followUpsByQuestionId,
      testcaseCountsByQuestionId,
      sampleTestcases,
      testcaseSummary,
    ] = await Promise.all([
      this.getExamplesByQuestionId([questionId]),
      this.getHintsByQuestionId([questionId]),
      this.getFollowUpsByQuestionId([questionId]),
      this.getTestcaseCounts([questionId]),
      this.testCaseModel
        .find({
          questionId,
          $or: [{ isSample: true }, { isHidden: false }],
        })
        .sort({ 'input.n': 1, createdAt: 1 })
        .select(
          'input validationType expectedOutput expectedOutputCount isSample isHidden weight',
        )
        .lean(),
      this.getTestcaseSummary([questionId]).then(
        (summaryMap) => summaryMap.get(questionId) ?? emptyTestcaseSummary(),
      ),
    ]);

    const counts =
      testcaseCountsByQuestionId.get(questionId) ?? emptyTestcaseCounts();

    const base = this.mapQuestionToListItem(question, {
      examples: examplesByQuestionId.get(questionId) ?? [],
      hints: hintsByQuestionId.get(questionId) ?? [],
      followUps: followUpsByQuestionId.get(questionId) ?? [],
      counts,
    });

    return {
      ...base,
      sampleTestcases: sampleTestcases.map((testcase) =>
        formatTestcaseResponse(testcase),
      ),
      testcaseSummary,
      judging: buildJudgingInfo(question.outputType, testcaseSummary),
      hiddenTestcaseCount: counts.hiddenTestcaseCount,
    };
  }

  async bulkUpload(dto: BulkUploadQuestionsDto, context?: ActivityLogContext) {
    if (!dto.questions?.length && !dto.testcases?.length) {
      throw new BadRequestException(
        'At least one question or testcase is required',
      );
    }

    if (dto.questions?.length) {
      const questionIds = dto.questions.map((q) => q.questionId);
      const uniqueIds = new Set(questionIds);
      if (uniqueIds.size !== questionIds.length) {
        throw new BadRequestException('Duplicate questionId in questions array');
      }

      const titles = dto.questions.map((q) => q.title);
      const uniqueTitles = new Set(titles);
      if (uniqueTitles.size !== titles.length) {
        throw new BadRequestException('Duplicate title in questions array');
      }
    }

    const { questionResult, questionIdMap } = dto.questions?.length
      ? await this.upsertQuestions(dto.questions)
      : {
          questionResult: { upserted: 0, modified: 0, updatedByTitle: 0 },
          questionIdMap: new Map<number, number>(),
        };

    const examplesAndHintsResult = dto.questions?.length
      ? await this.upsertExamplesHintsAndFollowUps(dto.questions, questionIdMap)
      : { examples: { inserted: 0 }, hints: { inserted: 0 }, followUps: { inserted: 0 } };

    const testcaseResult = dto.testcases?.length
      ? await this.upsertTestCases(dto.testcases, questionIdMap)
      : { inserted: 0, upsertedQuestionIds: 0 };

    const result = {
      questions: questionResult,
      examples: examplesAndHintsResult.examples,
      hints: examplesAndHintsResult.hints,
      followUps: examplesAndHintsResult.followUps,
      testcases: testcaseResult,
    };

    if (context?.userId) {
      await this.activityLogsService.log({
        ...context,
        module: ActivityModule.QUESTIONS,
        action: ActivityAction.BULK_UPLOAD,
        payload: {
          questionIds: dto.questions?.map((q) => q.questionId) ?? [],
          questionTitles: dto.questions?.map((q) => q.title) ?? [],
          testcaseQuestionIds: [
            ...new Set(dto.testcases?.map((t) => t.questionId) ?? []),
          ],
          summary: result,
        },
      });
    }

    return result;
  }

  private async upsertQuestions(
    questions: NonNullable<BulkUploadQuestionsDto['questions']>,
  ) {
    const existingByTitle = await this.questionModel
      .find({ title: { $in: questions.map((q) => q.title) } })
      .select('_id title questionId')
      .lean();

    const titleToExisting = new Map(
      existingByTitle.map((question) => [question.title, question]),
    );
    const questionIdMap = new Map<number, number>();
    let updatedByTitle = 0;

    const operations = questions.map((question) => {
      const payload = this.normalizeQuestion(question);
      const existing = titleToExisting.get(question.title);

      if (existing) {
        updatedByTitle += 1;
        questionIdMap.set(question.questionId, existing.questionId);

        return {
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                ...payload,
                questionId: existing.questionId,
              },
            },
          },
        };
      }

      questionIdMap.set(question.questionId, question.questionId);

      return {
        updateOne: {
          filter: { questionId: question.questionId },
          update: { $set: payload },
          upsert: true,
        },
      };
    });

    const result = await this.questionModel.bulkWrite(operations);

    return {
      questionResult: {
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
        updatedByTitle,
      },
      questionIdMap,
    };
  }

  private async upsertExamplesHintsAndFollowUps(
    questions: NonNullable<BulkUploadQuestionsDto['questions']>,
    questionIdMap: Map<number, number>,
  ) {
    let examplesInserted = 0;
    let hintsInserted = 0;
    let followUpsInserted = 0;

    for (const question of questions) {
      const resolvedQuestionId =
        questionIdMap.get(question.questionId) ?? question.questionId;

      if (question.examples?.length) {
        await this.exampleModel.deleteMany({ questionId: resolvedQuestionId });
        const examples = await this.exampleModel.insertMany(
          question.examples.map((example) => ({
            questionId: resolvedQuestionId,
            input: example.input,
            output: example.output,
            explanation: example.explanation,
          })),
        );
        examplesInserted += examples.length;
      }

      if (question.hints?.length) {
        await this.hintModel.deleteMany({ questionId: resolvedQuestionId });
        const hints = await this.hintModel.insertMany(
          question.hints.map((hint, index) => ({
            questionId: resolvedQuestionId,
            hint,
            order: index,
          })),
        );
        hintsInserted += hints.length;
      }

      if (question.followUps?.length) {
        await this.followUpModel.deleteMany({ questionId: resolvedQuestionId });
        const followUps = await this.followUpModel.insertMany(
          question.followUps.map((followUp, index) => ({
            questionId: resolvedQuestionId,
            followUp,
            order: index,
          })),
        );
        followUpsInserted += followUps.length;
      }
    }

    return {
      examples: { inserted: examplesInserted },
      hints: { inserted: hintsInserted },
      followUps: { inserted: followUpsInserted },
    };
  }

  private async upsertTestCases(
    testcases: NonNullable<BulkUploadQuestionsDto['testcases']>,
    questionIdMap: Map<number, number>,
  ) {
    const docs = testcases.map((testcase) =>
      this.buildTestCaseDocument(
        testcase,
        questionIdMap.get(testcase.questionId) ?? testcase.questionId,
      ),
    );

    const affectedQuestionIds = [
      ...new Set(docs.map((testcase) => testcase.questionId)),
    ];

    await this.testCaseModel.deleteMany({
      questionId: { $in: affectedQuestionIds },
    });

    const inserted = await this.testCaseModel.insertMany(docs);

    return {
      inserted: inserted.length,
      upsertedQuestionIds: affectedQuestionIds.length,
    };
  }

  private normalizeQuestion(question: QuestionItemDto) {
    const {
      examples: _examples,
      hints: _hints,
      followUps: _followUps,
      ...questionData
    } = question;

    return questionData;
  }

  private buildTestCaseDocument(
    testcase: NonNullable<BulkUploadQuestionsDto['testcases']>[number],
    questionId: number,
  ) {
    const validationType =
      testcase.validationType ??
      (testcase.expectedOutputCount !== undefined &&
      testcase.expectedOutput === undefined
        ? 'count_only'
        : 'exact');

    const base = {
      questionId,
      input: testcase.input,
      validationType,
      isSample: testcase.isSample ?? false,
      isHidden: testcase.isHidden ?? true,
      weight: testcase.weight ?? 1,
    };

    if (validationType === 'count_only') {
      return {
        ...base,
        expectedOutputCount: testcase.expectedOutputCount,
      };
    }

    return {
      ...base,
      expectedOutput: testcase.expectedOutput,
    };
  }

  private async buildQuestionListResponse(
    questions: QuestionSourceDocument[],
    userId: string,
  ): Promise<QuestionListItemResponse[]> {
    if (questions.length === 0) {
      return [];
    }

    const questionIds = questions.map((question) => question.questionId);

    const [
      examplesByQuestionId,
      hintsByQuestionId,
      followUpsByQuestionId,
      testcaseCountsByQuestionId,
      progressByQuestionId,
    ] = await Promise.all([
      this.getExamplesByQuestionId(questionIds),
      this.getHintsByQuestionId(questionIds),
      this.getFollowUpsByQuestionId(questionIds),
      this.getTestcaseCounts(questionIds),
      this.userProgressService.getProgressForQuestionIds(userId, questionIds),
    ]);

    return questions.map((question) =>
      this.mapQuestionToListItem(question, {
        examples: examplesByQuestionId.get(question.questionId) ?? [],
        hints: hintsByQuestionId.get(question.questionId) ?? [],
        followUps: followUpsByQuestionId.get(question.questionId) ?? [],
        counts:
          testcaseCountsByQuestionId.get(question.questionId) ??
          emptyTestcaseCounts(),
        userProgress: progressByQuestionId.get(question.questionId),
      }),
    );
  }

  private mapQuestionToListItem(
    question: QuestionSourceDocument,
    related: {
      examples: QuestionExampleResponse[];
      hints: string[];
      followUps: string[];
      counts: TestcaseCounts;
      userProgress?: QuestionListItemResponse['userProgress'];
    },
  ): QuestionListItemResponse {
    return {
      questionId: question.questionId,
      title: question.title,
      category: question.category,
      pattern: question.pattern,
      difficulty: question.difficulty,
      problemStatement: question.problemStatement,
      constraints: question.constraints ?? [],
      expectedTimeComplexity: question.expectedTimeComplexity,
      expectedSpaceComplexity: question.expectedSpaceComplexity,
      tags: question.tags ?? [],
      outputType: question.outputType,
      timeLimitMs: question.timeLimitMs ?? DEFAULT_QUESTION_TIME_LIMIT_MS,
      followUps: this.resolveFollowUps(related.followUps, question),
      examples: this.resolveExamples(related.examples, question),
      hints: this.resolveHints(related.hints, question),
      testcaseCount: related.counts.testcaseCount,
      sampleTestcaseCount: related.counts.sampleTestcaseCount,
      userProgress: related.userProgress,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private resolveExamples(
    fromCollection: QuestionExampleResponse[],
    question: QuestionSourceDocument,
  ) {
    return fromCollection.length > 0
      ? fromCollection
      : (question.examples ?? []);
  }

  private resolveHints(fromCollection: string[], question: QuestionSourceDocument) {
    return fromCollection.length > 0 ? fromCollection : (question.hints ?? []);
  }

  private resolveFollowUps(
    fromCollection: string[],
    question: QuestionSourceDocument,
  ) {
    return fromCollection.length > 0
      ? fromCollection
      : (question.followUps ?? []);
  }

  private async getExamplesByQuestionId(questionIds: number[]) {
    const examples = await this.exampleModel
      .find({ questionId: { $in: questionIds } })
      .select('questionId input output explanation')
      .lean();

    const examplesByQuestionId = new Map<number, QuestionExampleResponse[]>();

    for (const questionId of questionIds) {
      examplesByQuestionId.set(questionId, []);
    }

    for (const example of examples) {
      const questionExamples = examplesByQuestionId.get(example.questionId);
      if (questionExamples) {
        questionExamples.push({
          input: example.input,
          output: example.output,
          explanation: example.explanation,
        });
      }
    }

    return examplesByQuestionId;
  }

  private async getHintsByQuestionId(questionIds: number[]) {
    const hints = await this.hintModel
      .find({ questionId: { $in: questionIds } })
      .sort({ order: 1 })
      .select('questionId hint')
      .lean();

    const hintsByQuestionId = new Map<number, string[]>();

    for (const questionId of questionIds) {
      hintsByQuestionId.set(questionId, []);
    }

    for (const hint of hints) {
      const questionHints = hintsByQuestionId.get(hint.questionId);
      if (questionHints) {
        questionHints.push(hint.hint);
      }
    }

    return hintsByQuestionId;
  }

  private async getFollowUpsByQuestionId(questionIds: number[]) {
    const followUps = await this.followUpModel
      .find({ questionId: { $in: questionIds } })
      .sort({ order: 1 })
      .select('questionId followUp')
      .lean();

    const followUpsByQuestionId = new Map<number, string[]>();

    for (const questionId of questionIds) {
      followUpsByQuestionId.set(questionId, []);
    }

    for (const followUp of followUps) {
      const questionFollowUps = followUpsByQuestionId.get(followUp.questionId);
      if (questionFollowUps) {
        questionFollowUps.push(followUp.followUp);
      }
    }

    return followUpsByQuestionId;
  }

  private async getTestcaseCounts(questionIds: number[]) {
    const counts = await this.testCaseModel.aggregate<{
      _id: number;
      testcaseCount: number;
      sampleTestcaseCount: number;
      hiddenTestcaseCount: number;
    }>([
      { $match: { questionId: { $in: questionIds } } },
      {
        $group: {
          _id: '$questionId',
          testcaseCount: { $sum: 1 },
          sampleTestcaseCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$isSample', true] },
                    { $eq: ['$isHidden', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          hiddenTestcaseCount: {
            $sum: {
              $cond: [{ $eq: ['$isHidden', true] }, 1, 0],
            },
          },
        },
      },
    ]);

    const countsByQuestionId = new Map<number, TestcaseCounts>();

    for (const questionId of questionIds) {
      countsByQuestionId.set(questionId, emptyTestcaseCounts());
    }

    for (const count of counts) {
      countsByQuestionId.set(count._id, {
        testcaseCount: count.testcaseCount,
        sampleTestcaseCount: count.sampleTestcaseCount,
        hiddenTestcaseCount: count.hiddenTestcaseCount,
      });
    }

    return countsByQuestionId;
  }

  private getTestcaseSummary(questionIds: number[]) {
    return getTestcaseSummaryByQuestionIds(this.testCaseModel, questionIds);
  }

  private buildQuestionFilter(query: ListQuestionsQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }

    const tagList = this.parseTagsFilter(query.tags);
    if (tagList.length === 1) {
      filter.tags = tagList[0];
    } else if (tagList.length > 1) {
      filter.tags = { $in: tagList };
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { category: { $regex: query.search, $options: 'i' } },
        { pattern: { $regex: query.search, $options: 'i' } },
        { tags: { $regex: query.search, $options: 'i' } },
      ];
    }

    return filter;
  }

  private parseTagsFilter(tags?: string) {
    if (!tags) {
      return [];
    }

    return [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))];
  }

  private buildAppliedFilters(
    query: ListQuestionsQueryDto,
  ): QuestionListAppliedFilters {
    const appliedFilters: QuestionListAppliedFilters = {};

    if (query.category) {
      appliedFilters.category = query.category;
    }

    if (query.difficulty) {
      appliedFilters.difficulty = query.difficulty;
    }

    const tags = this.parseTagsFilter(query.tags);
    if (tags.length > 0) {
      appliedFilters.tags = tags;
    }

    if (query.search) {
      appliedFilters.search = query.search;
    }

    if (query.roadmapId) {
      appliedFilters.roadmapId = query.roadmapId;
    }

    if (query.roadmap) {
      appliedFilters.roadmap = query.roadmap;
    }

    if (query.useActiveRoadmap) {
      appliedFilters.useActiveRoadmap = true;
    }

    return appliedFilters;
  }
}

type QuestionSourceDocument = {
  questionId: number;
  title: string;
  category: string;
  pattern: string;
  difficulty: string;
  problemStatement: string;
  constraints?: string[];
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
  tags?: string[];
  outputType?: string;
  timeLimitMs?: number;
  examples?: QuestionExampleResponse[];
  hints?: string[];
  followUps?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};
