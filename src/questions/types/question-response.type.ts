import type { QuestionUserProgress } from '../../user-progress/types/user-progress-response.type';

export type QuestionExampleResponse = {
  input: Record<string, unknown>;
  output: unknown;
  explanation?: string;
};

export type QuestionTestcaseResponse = {
  input: unknown;
  validationType: 'exact' | 'count_only';
  expectedOutput?: unknown;
  expectedOutputCount?: number;
  isSample: boolean;
  isHidden: boolean;
  weight: number;
};

export type QuestionTestcaseSummary = {
  total: number;
  sample: number;
  hidden: number;
  exact: number;
  countOnly: number;
  hiddenCountOnly: number;
};

export type QuestionJudgingResponse = {
  outputType: string;
  supportsCountOnlyValidation: boolean;
  comparisonNote?: string;
};

export type QuestionListItemResponse = {
  questionId: number;
  title: string;
  category: string;
  pattern: string;
  difficulty: string;
  problemStatement: string;
  constraints: string[];
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
  tags: string[];
  outputType?: string;
  timeLimitMs?: number;
  followUps: string[];
  examples: QuestionExampleResponse[];
  hints: string[];
  testcaseCount: number;
  sampleTestcaseCount: number;
  userProgress?: QuestionUserProgress;
  createdAt?: Date;
  updatedAt?: Date;
};

export type QuestionDetailResponse = QuestionListItemResponse & {
  sampleTestcases: QuestionTestcaseResponse[];
  testcaseSummary: QuestionTestcaseSummary;
  judging: QuestionJudgingResponse;
  hiddenTestcaseCount: number;
};

type TestcaseCounts = {
  testcaseCount: number;
  sampleTestcaseCount: number;
  hiddenTestcaseCount: number;
};

export function resolveTestcaseValidationType(testcase: {
  validationType?: 'exact' | 'count_only';
  expectedOutput?: unknown;
  expectedOutputCount?: number;
}): 'exact' | 'count_only' {
  if (testcase.validationType) {
    return testcase.validationType;
  }

  if (
    testcase.expectedOutputCount !== undefined &&
    testcase.expectedOutput === undefined
  ) {
    return 'count_only';
  }

  return 'exact';
}

export function formatTestcaseResponse(testcase: {
  input: unknown;
  validationType?: 'exact' | 'count_only';
  expectedOutput?: unknown;
  expectedOutputCount?: number;
  isSample?: boolean;
  isHidden?: boolean;
  weight?: number;
}): QuestionTestcaseResponse {
  const validationType = resolveTestcaseValidationType(testcase);

  return {
    input: testcase.input,
    validationType,
    ...(validationType === 'count_only'
      ? { expectedOutputCount: testcase.expectedOutputCount ?? 0 }
      : { expectedOutput: testcase.expectedOutput }),
    isSample: Boolean(testcase.isSample),
    isHidden: Boolean(testcase.isHidden),
    weight: typeof testcase.weight === 'number' ? testcase.weight : 1,
  };
}

export function emptyTestcaseSummary(): QuestionTestcaseSummary {
  return {
    total: 0,
    sample: 0,
    hidden: 0,
    exact: 0,
    countOnly: 0,
    hiddenCountOnly: 0,
  };
}

export function buildJudgingInfo(
  outputType: string | undefined,
  summary: QuestionTestcaseSummary,
): QuestionJudgingResponse {
  const resolvedOutputType =
    outputType ?? (summary.countOnly > 0 ? 'unordered_array' : 'exact');

  const comparisonNotes: Record<string, string> = {
    exact: 'Outputs are compared exactly.',
    unordered_array:
      'Array outputs are compared after sorting (order does not matter).',
    unordered_nested_array:
      'Nested array outputs are normalized and sorted before comparison.',
    linked_list:
      'Linked list outputs are compared as ordered value arrays (head to tail).',
    tree: 'Tree outputs are compared as level-order array representations.',
    count_only:
      'Outputs are validated by result count (length) rather than full value comparison.',
  };

  return {
    outputType: resolvedOutputType,
    supportsCountOnlyValidation:
      summary.countOnly > 0 || resolvedOutputType === 'count_only',
    comparisonNote: comparisonNotes[resolvedOutputType],
  };
}

export function emptyTestcaseCounts(): TestcaseCounts {
  return {
    testcaseCount: 0,
    sampleTestcaseCount: 0,
    hiddenTestcaseCount: 0,
  };
}

export type { TestcaseCounts };
