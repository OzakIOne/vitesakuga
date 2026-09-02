import { useCallback, useRef, useState } from "react";

import {
  readStoredDraft,
  removeStoredDraft,
  writeStoredDraft,
} from "../../utils/draft-storage";
import type { Tag } from "../posts/posts.schema";

export type UploadDraftData = {
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

type UseUploadDraftReturn = {
  draft: UploadDraftData | null;
  persist: (values: UploadDraftData) => void;
  clear: () => void;
};

const DRAFT_STORAGE_KEY = "upload-draft";

export function useUploadDraft(): UseUploadDraftReturn {
  const [draft] = useState<UploadDraftData | null>(() =>
    readStoredDraft<UploadDraftData>(DRAFT_STORAGE_KEY),
  );
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const persist = useCallback((values: UploadDraftData) => {
    clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      writeStoredDraft(DRAFT_STORAGE_KEY, {
        description: values.description ?? "",
        relatedPostId: values.relatedPostId,
        source: values.source,
        tags: values.tags ?? [],
        title: values.title ?? "",
        videoName: values.videoName ?? "",
        seasonNumber: values.seasonNumber,
        episodeNumber: values.episodeNumber,
        chapterNumber: values.chapterNumber,
        volumeNumber: values.volumeNumber,
      });
    }, 500);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(persistTimeoutRef.current);
    removeStoredDraft(DRAFT_STORAGE_KEY);
  }, []);

  return {
    clear,
    draft,
    persist,
  };
}
