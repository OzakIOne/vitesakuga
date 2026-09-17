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

/**
 * Stable object identity for the lifecycle registry. The operation id is
 * durable, so retries reuse exactly the same key instead of creating a new
 * object. The `media/` namespace is server-managed and is never presigned.
 */
export type DeterministicMediaKind = "video" | "image" | "thumbnail";

export const mediaObjectKey = (
  operationId: string,
  kind: DeterministicMediaKind,
  ordinal = 0,
  extension = "bin",
): string =>
  `media/${kind}/${operationId}/${String(ordinal).padStart(4, "0")}.${extension.toLowerCase()}`;

export const videoObjectKey = (
  operationId: string,
  extension: string,
): string => mediaObjectKey(operationId, "video", 0, extension);

export const imageObjectKey = (
  operationId: string,
  ordinal: number,
  extension: string,
): string => mediaObjectKey(operationId, "image", ordinal, extension);

export const thumbnailObjectKey = (operationId: string): string =>
  mediaObjectKey(operationId, "thumbnail", 0, "jpg");

/** Deterministic staging key for a direct video upload. */
export const pendingVideoObjectKey = (
  userId: string,
  operationId: string,
  extension: string,
): string =>
  `${pendingVideoPrefix(userId)}${operationId}.${extension.toLowerCase()}`;

const DETERMINISTIC_MEDIA_KEY_PATTERN =
  /^media\/(video|image|thumbnail)\/[A-Za-z0-9_-]{1,128}\/\d{4}\.[a-z0-9]{1,12}$/;

/** True only for keys generated in the non-presigned managed namespace. */
export const isDeterministicMediaKey = (key: string): boolean =>
  DETERMINISTIC_MEDIA_KEY_PATTERN.test(key);

/** True only for a caller's own deterministic direct-video staging key. */
export const isDeterministicPendingVideoKey = (
  key: string,
  userId: string,
): boolean =>
  /^[A-Za-z0-9_-]{1,128}$/.test(userId) &&
  key.startsWith(pendingVideoPrefix(userId)) &&
  /^[A-Za-z0-9_-]{1,128}\.[a-z0-9]{1,12}$/.test(
    key.slice(pendingVideoPrefix(userId).length),
  );
