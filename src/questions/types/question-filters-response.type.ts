import type { QuestionListItemResponse } from './question-response.type';

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
};

export type QuestionListResponse = {
  items: QuestionListItemResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    appliedFilters: QuestionListAppliedFilters;
  };
  filters: QuestionFiltersResponse;
};
