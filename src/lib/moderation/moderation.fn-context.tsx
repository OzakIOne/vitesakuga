import { createContext, useContext } from "react";

import type { approveEdit, rejectEdit } from "../post-edits/post-edits.service";
import type {
  approvePromotion,
  fetchPromotionQueue,
  rejectPromotion,
} from "../promotions/promotions.service";
import type { previewGc, runGc } from "../videos/videos.service";
import type {
  assignUserRole,
  fetchAccountModerationEvents,
  fetchModerationOverview,
  suspendUser,
  unsuspendUser,
} from "./moderation.service";

export type ModerationFns = {
  approveEdit: typeof approveEdit;
  approvePromotion: typeof approvePromotion;
  assignUserRole: typeof assignUserRole;
  fetchAccountModerationEvents: typeof fetchAccountModerationEvents;
  fetchModerationOverview: typeof fetchModerationOverview;
  fetchPromotionQueue: typeof fetchPromotionQueue;
  previewGc: typeof previewGc;
  rejectEdit: typeof rejectEdit;
  rejectPromotion: typeof rejectPromotion;
  runGc: typeof runGc;
  suspendUser: typeof suspendUser;
  unsuspendUser: typeof unsuspendUser;
};

export const ModerationFnsContext = createContext<ModerationFns | null>(null);

export const useModerationFns = (): ModerationFns => {
  const fns = useContext(ModerationFnsContext);
  if (fns === null) {
    throw new Error("ModerationFnsContext is not provided");
  }
  return fns;
};
