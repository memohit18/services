export type ApiResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedData<T> = {
  items: T[];
  meta: PaginatedMeta;
};

export function successResponse<T>(data: T, message = 'Success'): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success',
): ApiResponse<PaginatedData<T>> {
  return successResponse(
    {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    },
    message,
  );
}
