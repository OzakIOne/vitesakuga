import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import type { Tag } from "src/lib/posts/posts.schema";

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
  description: string;
  source: string | undefined;
  relatedPostId: number | undefined;
  tags: Tag[];
  videoName: string;
  seasonNumber: number | undefined;
  episodeNumber: number | undefined;
  chapterNumber: number | undefined;
  volumeNumber: number | undefined;
};

export const uploadDraftCollection = createCollection(
  localStorageCollectionOptions({
    id: "upload-draft",
    storageKey: "upload-draft",
    getKey: (item: UploadDraft) => item.id,
  }),
);
