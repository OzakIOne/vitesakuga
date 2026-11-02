import { approveEdit, rejectEdit } from "../post-edits/post-edits.service";
import {
  approvePromotion,
  fetchPromotionQueue,
  rejectPromotion,
} from "../promotions/promotions.service";
import { previewGc, runGc } from "../videos/videos.service";
import type { ModerationFns } from "./moderation.fn-context";
import {
  assignUserRole,
  fetchAccountModerationEvents,
  fetchModerationOverview,
  suspendUser,
  unsuspendUser,
} from "./moderation.service";

export const defaultModerationFns: ModerationFns = {
  approveEdit,
  approvePromotion,
  assignUserRole,
  fetchAccountModerationEvents,
  fetchModerationOverview,
  fetchPromotionQueue,
  previewGc,
  rejectEdit,
  rejectPromotion,
  runGc,
  suspendUser,
  unsuspendUser,
};
