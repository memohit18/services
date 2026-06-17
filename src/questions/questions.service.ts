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
import {
  emptyTestcaseCounts,
  formatTestcaseResponse,
  type QuestionDetailResponse,
  type QuestionExampleResponse,
  type QuestionListItemResponse,
  type TestcaseCounts,
} from './types/question-response.type';

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
  ) {}

  async findAll(query: ListQuestionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildQuestionFilter(query);

    const [items, total] = await Promise.all([
      this.questionModel
        .find(filter)
        .sort({ questionId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-__v')
        .lean(),
      this.questionModel.countDocuments(filter),
    ]);

    const enrichedItems = await this.buildQuestionListResponse(items);

    return {
      items: enrichedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
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
        .select('input expectedOutput isSample isHidden weight')
        .lean(),
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
      hiddenTestcaseCount: counts.hiddenTestcaseCount,
    };
  }

  async bulkUpload(dto: BulkUploadQuestionsDto) {
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

    return {
      questions: questionResult,
      examples: examplesAndHintsResult.examples,
      hints: examplesAndHintsResult.hints,
      followUps: examplesAndHintsResult.followUps,
      testcases: testcaseResult,
    };
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
    const docs = testcases.map((testcase) => ({
      questionId: questionIdMap.get(testcase.questionId) ?? testcase.questionId,
      input: testcase.input,
      expectedOutput: testcase.expectedOutput,
      isSample: testcase.isSample ?? false,
      isHidden: testcase.isHidden ?? true,
      weight: testcase.weight ?? 1,
    }));

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

  private async buildQuestionListResponse(
    questions: QuestionSourceDocument[],
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
    ] = await Promise.all([
      this.getExamplesByQuestionId(questionIds),
      this.getHintsByQuestionId(questionIds),
      this.getFollowUpsByQuestionId(questionIds),
      this.getTestcaseCounts(questionIds),
    ]);

    return questions.map((question) =>
      this.mapQuestionToListItem(question, {
        examples: examplesByQuestionId.get(question.questionId) ?? [],
        hints: hintsByQuestionId.get(question.questionId) ?? [],
        followUps: followUpsByQuestionId.get(question.questionId) ?? [],
        counts:
          testcaseCountsByQuestionId.get(question.questionId) ??
          emptyTestcaseCounts(),
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
      followUps: this.resolveFollowUps(related.followUps, question),
      examples: this.resolveExamples(related.examples, question),
      hints: this.resolveHints(related.hints, question),
      testcaseCount: related.counts.testcaseCount,
      sampleTestcaseCount: related.counts.sampleTestcaseCount,
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

  private buildQuestionFilter(query: ListQuestionsQueryDto) {
    const filter: Record<string, unknown> = {};

    if (query.category) {
      filter.category = query.category;
    }

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
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
  examples?: QuestionExampleResponse[];
  hints?: string[];
  followUps?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};
