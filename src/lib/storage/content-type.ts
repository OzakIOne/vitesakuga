// Content types are derived server-side from the whitelisted file extension
// instead of trusting the client-supplied `File.type`: the media bucket is
// publicly served, so a spoofed Content-Type could turn any object into an
// HTML document on the media subdomain (see security audit H2).
export const THUMBNAIL_CONTENT_TYPE = "image/jpeg";

const VIDEO_CONTENT_TYPES = [
  ["avi", "video/x-msvideo"],
  ["flv", "video/x-flv"],
  ["mkv", "video/x-matroska"],
  ["mov", "video/quicktime"],
  ["mp4", "video/mp4"],
  ["wmv", "video/x-ms-wmv"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const VIDEO_CONTENT_TYPE_LOOKUP = new Map<string, string>(VIDEO_CONTENT_TYPES);

export const videoContentType = (ext: string): string =>
  VIDEO_CONTENT_TYPE_LOOKUP.get(ext.toLowerCase()) ??
  "application/octet-stream";

const IMAGE_CONTENT_TYPES = [
  ["gif", "image/gif"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const IMAGE_CONTENT_TYPE_LOOKUP = new Map<string, string>(IMAGE_CONTENT_TYPES);

export const imageContentType = (ext: string): string =>
  IMAGE_CONTENT_TYPE_LOOKUP.get(ext.toLowerCase()) ??
  "application/octet-stream";
