const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const IFRAME_RE = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
const OBJECT_RE = /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi;
const EMBED_RE = /<embed\b[^>]*\/?>/gi;
const ON_ATTR_DQ_RE = /\bon\w+\s*=\s*"[^"]*"/gi;
const ON_ATTR_SQ_RE = /\bon\w+\s*=\s*'[^']*'/gi;
const JS_PROTO_RE = /javascript\s*:/gi;

export function sanitize(dirty: string): string {
  return dirty
    .replace(SCRIPT_RE, "")
    .replace(IFRAME_RE, "")
    .replace(OBJECT_RE, "")
    .replace(EMBED_RE, "")
    .replace(ON_ATTR_DQ_RE, "")
    .replace(ON_ATTR_SQ_RE, "")
    .replace(JS_PROTO_RE, "");
}
