/**
 * Key namespaces for the direct-to-R2 video upload lifecycle (security audit
 * L4): presigned PUTs land under the staging prefix, and only uploads that
 * pass confirm-time validation are promoted out of it. Anything left under
 * the staging prefix is garbage by definition and expires via the bucket's
 * lifecycle rule (`infra/alchemy.run.ts`) — closing the orphan window where
 * a video was PUT to R2 but its confirm call never ran.
 */

/** Staging namespace for unconfirmed direct-to-R2 uploads. */
export const PENDING_VIDEOS_PREFIX = "videos/_pending/";

/** Per-user staging scope; confirms must reject keys outside of it. */
export const pendingVideoPrefix = (userId: string): string =>
  `${PENDING_VIDEOS_PREFIX}${userId}/`;

/**
 * Final media key for a pending upload:
 * `videos/_pending/{userId}/{uuid}.{ext}` -> `videos/{userId}/{uuid}.{ext}`.
 * Only meaningful for keys under the staging namespace.
 */
export const finalizedVideoKey = (pendingKey: string): string =>
  pendingKey.replace(PENDING_VIDEOS_PREFIX, "videos/");
