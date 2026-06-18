/** Reference module names — any string is allowed when logging. */
export const ActivityModule = {
  QUESTIONS: 'questions',
  SUBMISSIONS: 'submissions',
  USER_PROGRESS: 'user_progress',
} as const;

/** Reference action names — any string is allowed when logging. */
export const ActivityAction = {
  BULK_UPLOAD: 'bulk_upload',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type ActivityLogContext = {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateActivityLogInput = ActivityLogContext & {
  action: string;
  module: string;
  payload?: Record<string, unknown>;
};

export type ActivityLogResponse = {
  activityLogId: string;
  userId?: string;
  action: string;
  module: string;
  payload: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ActivityLogListResponse = {
  items: ActivityLogResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    appliedFilters: {
      module?: string;
      action?: string;
    };
  };
  filters: {
    modules: string[];
    actions: string[];
  };
};
