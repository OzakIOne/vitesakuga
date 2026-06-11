import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef } from "react";

import type { DbSchemaSelect } from "../db/schema";
import type { PaginationMeta } from "../pagination/pagination";

type PopularTag = {
  id: number;
  name: string;
  postCount: number;
};

export type PostListingData = {
  data: DbSchemaSelect["posts"][];
  meta: {
    pagination: PaginationMeta;
    popularTags: PopularTag[];
  };
};

export function usePostsPage<
  TData extends PostListingData,
  TQueryKey extends QueryKey = QueryKey,
>(queryOptions: UseQueryOptions<TData, Error, TData, TQueryKey>) {
  const navigate = useNavigate();
  const previousDataRef = useRef<TData | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isFetching } = useQuery({
    ...queryOptions,
    placeholderData: previousDataRef.current as any,
  }) as { data: TData; isFetching: boolean };

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
    data,
    handlePageChange,
    isFetching,
    popularTags: data?.meta?.popularTags ?? [],
    posts: data?.data ?? [],
    totalPages: data?.meta?.pagination?.totalPages ?? 0,
  };
}
