export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginationMeta = {
  currentPage: number;
  hasMore: boolean;
  hasPrevious: boolean;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
};

export function computePagination(
  totalCount: number,
  input: PaginationInput,
): PaginationMeta {
  const offset = input.page * input.pageSize;
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / input.pageSize);
  return {
    currentPage: input.page + 1,
    hasMore: offset + input.pageSize < totalCount,
    hasPrevious: offset > 0,
    limit: input.pageSize,
    offset,
    total: totalCount,
    totalPages,
  };
}
