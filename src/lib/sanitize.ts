import sanitizeHtml from "sanitize-html";

// sanitize-html is a pure-JS HTML parser (htmlparser2) with no DOM dependency,
// so it behaves identically in the browser, Node and Cloudflare Workers — no
// jsdom/linkedom shims or per-environment builds required.
const ALLOWED_TAGS = [...sanitizeHtml.defaults.allowedTags, "img"];

export function sanitize(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: ALLOWED_TAGS,
  });
}
