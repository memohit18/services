import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  QUESTION_MODEL,
  QuestionDocument,
} from '../../db-schema/mongodb/schemas/question.schema';
import {
  TEST_CASE_MODEL,
  TestCaseDocument,
} from '../../db-schema/mongodb/schemas/test-case.schema';
import { BulkUploadQuestionsDto } from './dto/bulk-upload-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(QUESTION_MODEL)
    private readonly questionModel: Model<QuestionDocument>,
    @InjectModel(TEST_CASE_MODEL)
    private readonly testCaseModel: Model<TestCaseDocument>,
  ) {}

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

    if (dto.testcases?.length) {
      await this.validateTestCaseQuestionIds(dto);
    }

    const { questionResult, questionIdMap } = dto.questions?.length
      ? await this.upsertQuestions(dto.questions)
      : {
          questionResult: { upserted: 0, modified: 0, updatedByTitle: 0 },
          questionIdMap: new Map<number, number>(),
        };

    const testcaseResult = dto.testcases?.length
      ? await this.insertTestCases(dto.testcases, questionIdMap)
      : { inserted: 0 };

    return {
      questions: questionResult,
      testcases: testcaseResult,
    };
  }

  private async validateTestCaseQuestionIds(dto: BulkUploadQuestionsDto) {
    const payloadQuestionIds = new Set(
      dto.questions?.map((q) => q.questionId) ?? [],
    );
    const testcaseQuestionIds = [
      ...new Set(dto.testcases!.map((tc) => tc.questionId)),
    ];

    const missingIds = testcaseQuestionIds.filter(
      (id) => !payloadQuestionIds.has(id),
    );

    if (missingIds.length === 0) {
      return;
    }

    const existing = await this.questionModel
      .find({ questionId: { $in: missingIds } })
      .select('questionId')
      .lean();

    const existingIds = new Set(existing.map((q) => q.questionId));
    const stillMissing = missingIds.filter((id) => !existingIds.has(id));

    if (stillMissing.length > 0) {
      throw new BadRequestException(
        `Testcases reference unknown questionId(s): ${stillMissing.join(', ')}`,
      );
    }
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
      const existing = titleToExisting.get(question.title);

      if (existing) {
        updatedByTitle += 1;
        questionIdMap.set(question.questionId, existing.questionId);

        return {
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                ...question,
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
          update: { $set: question },
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

  private async insertTestCases(
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

    const inserted = await this.testCaseModel.insertMany(docs);

    return {
      inserted: inserted.length,
    };
  }
}
