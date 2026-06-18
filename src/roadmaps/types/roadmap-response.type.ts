import type { QuestionListItemResponse } from '../../questions/types/question-response.type';

export type RoadmapQuestionInput = {
  questionId: number;
  order: number;
};

export type RoadmapListItemResponse = {
  roadmapId: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  questionCount: number;
};

export type RoadmapDetailResponse = RoadmapListItemResponse & {
  questions: Array<{
    questionId: number;
    order: number;
    title?: string;
  }>;
};

export type RoadmapFilterSummary = {
  roadmaps: Array<{
    roadmapId: string;
    name: string;
    slug: string;
    isActive: boolean;
    questionCount: number;
  }>;
  activeRoadmapId?: string;
};

export type RoadmapListResponse = {
  items: RoadmapListItemResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RoadmapFilterContext = {
  roadmapId: string;
  slug: string;
  name: string;
  isActive: boolean;
  orderedQuestionIds: number[];
};

export type QuestionRoadmapMeta = {
  roadmapId: string;
  slug: string;
  name: string;
  order: number;
};

export type QuestionListItemWithRoadmapResponse = QuestionListItemResponse & {
  roadmap?: QuestionRoadmapMeta;
};
