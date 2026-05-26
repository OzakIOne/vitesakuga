import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef } from "react";

type PaginationMeta = {
  currentPage: number;
  hasMore: boolean;
  hasPrevious: boolean;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
};

type PopularTag = {
  id: number;
  name: string;
  postCount: number;
};

type PostListingData = {
  data: unknown[];
  meta: {
    pagination: PaginationMeta;
    popularTags: PopularTag[];
  };
};

export function usePostsPage<TData extends PostListingData>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions: any,
) {
  const navigate = useNavigate();
  const previousDataRef = useRef<TData | undefined>(undefined);

  const queryResult = useQuery({
    ...queryOptions,
    placeholderData: previousDataRef.current,
  }) as { data: TData; isFetching: boolean };

  const { data, isFetching } = queryResult;

  if (data) {
    previousDataRef.current = data;
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          page: newPage,
        })) as never,
      });
      window.scrollTo({ behavior: "smooth", top: 0 });
    },
    [navigate],
  );

  return {
    data: data as TData,
    handlePageChange,
    isFetching,
    popularTags: data?.meta?.popularTags ?? [],
    posts: (data?.data ?? []) as TData["data"],
    totalPages: data?.meta?.pagination?.totalPages ?? 0,
  };
}
