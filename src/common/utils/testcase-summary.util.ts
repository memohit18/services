import type { Model } from 'mongoose';
import type { TestCaseDocument } from '../../../db-schema/mongodb/schemas/test-case.schema';
import {
  emptyTestcaseSummary,
  type QuestionTestcaseSummary,
} from '../../questions/types/question-response.type';

export async function getTestcaseSummaryByQuestionIds(
  testCaseModel: Model<TestCaseDocument>,
  questionIds: number[],
): Promise<Map<number, QuestionTestcaseSummary>> {
  if (!questionIds.length) {
    return new Map();
  }

  const summaries = await testCaseModel.aggregate<{
    _id: number;
    total: number;
    sample: number;
    hidden: number;
    exact: number;
    countOnly: number;
    hiddenCountOnly: number;
  }>([
    { $match: { questionId: { $in: questionIds } } },
    {
      $group: {
        _id: '$questionId',
        total: { $sum: 1 },
        sample: {
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
        hidden: {
          $sum: {
            $cond: [{ $eq: ['$isHidden', true] }, 1, 0],
          },
        },
        countOnly: {
          $sum: {
            $cond: [{ $eq: ['$validationType', 'count_only'] }, 1, 0],
          },
        },
        hiddenCountOnly: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$validationType', 'count_only'] },
                  { $eq: ['$isHidden', true] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        exact: { $subtract: ['$total', '$countOnly'] },
      },
    },
  ]);

  const summaryByQuestionId = new Map<number, QuestionTestcaseSummary>();

  for (const questionId of questionIds) {
    summaryByQuestionId.set(questionId, emptyTestcaseSummary());
  }

  for (const summary of summaries) {
    summaryByQuestionId.set(summary._id, {
      total: summary.total,
      sample: summary.sample,
      hidden: summary.hidden,
      exact: summary.exact,
      countOnly: summary.countOnly,
      hiddenCountOnly: summary.hiddenCountOnly,
    });
  }

  return summaryByQuestionId;
}
