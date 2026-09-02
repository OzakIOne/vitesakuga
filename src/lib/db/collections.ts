import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";

import { getQueryClient } from "../query-client";
import { getAllTags } from "../tags/tags.service";
import type { UserPublic } from "../users/users.schema";
import { fetchUsers } from "../users/users.service";

const queryClient = getQueryClient();

export const tagsCollection = createCollection(
  queryCollectionOptions<{ id: number; name: string }>({
    queryKey: ["tags", "collection"],
    queryFn: async () => getAllTags(),
    queryClient,
    getKey: (item) => item.id,
    syncMode: "eager",
  }),
);

export const usersCollection = createCollection(
  queryCollectionOptions<UserPublic>({
    queryKey: ["users", "collection"],
    queryFn: async () => [...(await fetchUsers())],
    queryClient,
    getKey: (item) => item.id,
    syncMode: "eager",
  }),
);
