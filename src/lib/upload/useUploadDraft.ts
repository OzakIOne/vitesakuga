import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useCallback, useRef } from "react";

import { uploadDraftCollection } from "../db/collections";
import type { Tag } from "../posts/posts.schema";

export type UploadDraftData = {
  title: string;
  content: string;
  source: string | undefined;
  relatedPostId: number | undefined;
  tags: Tag[];
  videoName: string;
};

type UseUploadDraftReturn = {
  draft: UploadDraftData | null;
  isLoaded: boolean;
  persist: (values: UploadDraftData) => void;
  clear: () => void;
};

const DRAFT_ID = "upload-draft";

export function useUploadDraft(): UseUploadDraftReturn {
  const { data: draftEntries } = useLiveQuery((query) =>
    query
      .from({ draft: uploadDraftCollection })
      .where(({ draft }) => eq(draft.id, DRAFT_ID)),
  );

  const draft = draftEntries[0] ?? null;
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const persist = useCallback((values: UploadDraftData) => {
    clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      const data = {
        content: values.content ?? "",
        id: DRAFT_ID,
        relatedPostId: values.relatedPostId,
        source: values.source,
        tags: values.tags ?? [],
        title: values.title ?? "",
        videoName: values.videoName ?? "",
      };

      if (uploadDraftCollection.state.get(DRAFT_ID)) {
        uploadDraftCollection.update(DRAFT_ID, (d) => {
          d.title = data.title;
          d.content = data.content;
          d.source = data.source;
          d.relatedPostId = data.relatedPostId;
          d.tags = data.tags;
          d.videoName = data.videoName;
        });
      } else {
        uploadDraftCollection.insert(data);
      }
    }, 500);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(persistTimeoutRef.current);
    uploadDraftCollection.delete(DRAFT_ID);
  }, []);

  return {
    clear,
    draft,
    isLoaded: true,
    persist,
  };
}
