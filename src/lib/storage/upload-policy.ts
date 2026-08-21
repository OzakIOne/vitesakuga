import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import type { UploadedFileHead } from "./storage.module";

// Presigned PUTs cannot enforce a size cap pre-upload (that needs an S3 POST
// policy, which R2 does not support), so the cap is enforced at confirm time
// against the object metadata. The Content-Type must also match the extension
// we signed, or the client could store arbitrary content under a video key.
export const isUploadedVideoValid = (
  head: UploadedFileHead,
  expectedContentType: string,
): boolean =>
  head.contentLength > 0 &&
  head.contentLength <= MAX_VIDEO_SIZE_BYTES &&
  head.contentType === expectedContentType;
