import type { Model } from 'mongoose';
import type { QuestionDocument } from '../../../db-schema/mongodb/schemas/question.schema';
import { DEFAULT_QUESTION_TIME_LIMIT_MS } from '../../../db-schema/mongodb/schemas/question.schema';
import type { TestCaseDocument } from '../../../db-schema/mongodb/schemas/test-case.schema';
import {
  buildJudgingInfo,
  emptyTestcaseSummary,
  type QuestionJudgingResponse,
  type QuestionTestcaseSummary,
} from '../../questions/types/question-response.type';
import { getTestcaseSummaryByQuestionIds } from './testcase-summary.util';

export type QuestionJudgingContext = {
  questionId: number;
  outputType?: string;
  timeLimitMs: number;
  judging: QuestionJudgingResponse;
  testcaseSummary: QuestionTestcaseSummary;
};

export async function getQuestionJudgingContext(
  questionModel: Model<QuestionDocument>,
  testCaseModel: Model<TestCaseDocument>,
  questionId: number,
): Promise<QuestionJudgingContext | null> {
  const contexts = await getQuestionJudgingContextsByQuestionIds(
    questionModel,
    testCaseModel,
    [questionId],
  );

  return contexts.get(questionId) ?? null;
}

export async function getQuestionJudgingContextsByQuestionIds(
  questionModel: Model<QuestionDocument>,
  testCaseModel: Model<TestCaseDocument>,
  questionIds: number[],
): Promise<Map<number, QuestionJudgingContext>> {
  const uniqueQuestionIds = [...new Set(questionIds)];

  if (!uniqueQuestionIds.length) {
    return new Map();
  }

  const [questions, summaryByQuestionId] = await Promise.all([
    questionModel
      .find({ questionId: { $in: uniqueQuestionIds } })
      .select('questionId outputType timeLimitMs')
      .lean(),
    getTestcaseSummaryByQuestionIds(testCaseModel, uniqueQuestionIds),
  ]);

  const contextByQuestionId = new Map<number, QuestionJudgingContext>();

  for (const question of questions) {
    const testcaseSummary =
      summaryByQuestionId.get(question.questionId) ?? emptyTestcaseSummary();

    contextByQuestionId.set(question.questionId, {
      questionId: question.questionId,
      outputType: question.outputType,
      timeLimitMs: question.timeLimitMs ?? DEFAULT_QUESTION_TIME_LIMIT_MS,
      judging: buildJudgingInfo(question.outputType, testcaseSummary),
      testcaseSummary,
    });
  }

  return contextByQuestionId;
}
