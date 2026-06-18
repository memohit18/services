import type { QuestionListItemResponse } from './question-response.type';
import type { QuestionRoadmapMeta } from '../../roadmaps/types/roadmap-response.type';

export type QuestionFiltersResponse = {
  categories: string[];
  tags: string[];
  difficulties: string[];
};

export type QuestionListAppliedFilters = {
  category?: string;
  difficulty?: string;
  tags?: string[];
  search?: string;
  roadmapId?: string;
  roadmap?: string;
  useActiveRoadmap?: boolean;
};

export type QuestionListRoadmapMeta = {
  roadmapId: string;
  slug: string;
  name: string;
  isActive: boolean;
};

export type QuestionListItemWithRoadmap = QuestionListItemResponse & {
  roadmap?: QuestionRoadmapMeta;
};

export type QuestionListResponse = {
  items: QuestionListItemWithRoadmap[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    appliedFilters: QuestionListAppliedFilters;
    roadmap?: QuestionListRoadmapMeta;
  };
  filters: QuestionFiltersResponse;
};
