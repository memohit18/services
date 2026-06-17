export type QuestionExampleResponse = {
  input: Record<string, unknown>;
  output: unknown;
  explanation?: string;
};

export type QuestionTestcaseResponse = {
  input: unknown;
  expectedOutput: unknown;
  isSample: boolean;
  isHidden: boolean;
  weight: number;
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
  followUps: string[];
  examples: QuestionExampleResponse[];
  hints: string[];
  testcaseCount: number;
  sampleTestcaseCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type QuestionDetailResponse = QuestionListItemResponse & {
  sampleTestcases: QuestionTestcaseResponse[];
  hiddenTestcaseCount: number;
};

type TestcaseCounts = {
  testcaseCount: number;
  sampleTestcaseCount: number;
  hiddenTestcaseCount: number;
};

export function formatTestcaseResponse(testcase: {
  input: unknown;
  expectedOutput: unknown;
  isSample?: boolean;
  isHidden?: boolean;
  weight?: number;
}): QuestionTestcaseResponse {
  return {
    input: testcase.input,
    expectedOutput: testcase.expectedOutput,
    isSample: Boolean(testcase.isSample),
    isHidden: Boolean(testcase.isHidden),
    weight: typeof testcase.weight === 'number' ? testcase.weight : 1,
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
