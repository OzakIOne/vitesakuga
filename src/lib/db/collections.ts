import "src/lib/polyfills";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";

import type { DbSchemaSelect } from "../db/schema";
import { getQueryClient } from "../query-client";
import { getAllTags } from "../tags/tags.service";
import { fetchUsers } from "../users/users.service";

const queryClient = getQueryClient();

export const tagsCollection = createCollection(
  queryCollectionOptions({
    queryKey: ["tags", "collection"],
    queryFn: async () => getAllTags(),
    queryClient,
    getKey: (item) => item.id,
    syncMode: "eager",
  }),
);

export const usersCollection = createCollection(
  queryCollectionOptions<DbSchemaSelect["user"]>({
    queryKey: ["users", "collection"],
    queryFn: async () => fetchUsers(),
    queryClient,
    getKey: (item) => item.id,
    syncMode: "eager",
  }),
);

type CommentDraft = {
  id: string;
  content: string;
};

export const commentDraftsCollection = createCollection(
  localStorageCollectionOptions({
    id: "comment-drafts",
    storageKey: "comment-drafts",
    getKey: (item: CommentDraft) => item.id,
  }),
);

type UploadDraft = {
  id: string;
  title: string;
  content: string;
  source: string | undefined;
  relatedPostId: number | undefined;
  tags: { id?: number; name: string }[];
  videoName: string;
};

export const uploadDraftCollection = createCollection(
  localStorageCollectionOptions({
    id: "upload-draft",
    storageKey: "upload-draft",
    getKey: (item: UploadDraft) => item.id,
  }),
);
