import { useContext } from "react";

import type { PostReportReason } from "../db/schema";
import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { ReportsFnsContext } from "./reports.fn-context";

/**
 * Submits (or updates) the current user's report on a post.
 * Pass one of the allowed report reasons.
 */
export function useSubmitReport(postId: number) {
  const { submitPostReport } = useContext(ReportsFnsContext);

  return useMutationWithFeedback({
    errorFallback: "Could not submit your report. Please try again.",
    errorTitle: "Error submitting report",
    mutationFn: async (reason: PostReportReason) =>
      submitPostReport({ data: { postId, reason } }),
    successDescription: "Thank you. A moderator will review this post.",
    successTitle: "Report submitted",
  });
}
