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
  fetchModerationOverview,
  suspendUser,
  unsuspendUser,
} from "./moderation.service";

export const defaultModerationFns: ModerationFns = {
  approveEdit,
  approvePromotion,
  assignUserRole,
  fetchModerationOverview,
  fetchPromotionQueue,
  previewGc,
  rejectEdit,
  rejectPromotion,
  runGc,
  suspendUser,
  unsuspendUser,
};
