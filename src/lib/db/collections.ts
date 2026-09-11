import {
  queryCollectionOptions,
  type QueryCollectionUtils,
} from "@tanstack/query-db-collection";
import { createCollection, type Collection } from "@tanstack/react-db";

import { getQueryClient } from "../query-client";
import { getAllTags } from "../tags/tags.service";

const queryClient = getQueryClient();

type TagRecord = { id: number; name: string };
type EagerQueryCollection<
  T extends object,
  TKey extends string | number,
> = Collection<T, TKey, QueryCollectionUtils<T, TKey, T>, never, T>;

export const tagsCollection: EagerQueryCollection<TagRecord, number> =
  createCollection(
    queryCollectionOptions({
      queryKey: ["tags", "collection"],
      queryFn: async (): Promise<TagRecord[]> => getAllTags(),
      queryClient,
      getKey: (item: TagRecord): number => item.id,
      syncMode: "eager",
    }),
  );
