import { useCallback, useRef, useState } from "react";

import {
  readStoredDraft,
  removeStoredDraft,
  writeStoredDraft,
} from "../../utils/draft-storage";

type UseCommentDraftReturn = {
  draft: string;
  setDraft: (content: string) => void;
  clear: () => void;
};

/** One draft slot per post, so comments on different posts never collide. */
const commentDraftKey = (postId: number) => `comment-draft:${postId}`;

export function useCommentDraft(postId: number): UseCommentDraftReturn {
  const storageKey = commentDraftKey(postId);
  const [draft, setDraftState] = useState<string>(
    () => readStoredDraft<{ content: string }>(storageKey)?.content ?? "",
  );
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const setDraft = useCallback(
    (content: string) => {
      setDraftState(content);
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = setTimeout(() => {
        writeStoredDraft(storageKey, { content });
      }, 500);
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    clearTimeout(persistTimeoutRef.current);
    removeStoredDraft(storageKey);
    setDraftState("");
  }, [storageKey]);

  return {
    clear,
    draft,
    setDraft,
  };
}
