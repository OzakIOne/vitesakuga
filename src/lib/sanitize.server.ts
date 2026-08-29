import sanitizeHtml from "sanitize-html";

import { registerSanitizer } from "./sanitize";

// sanitize-html is a pure-JS HTML parser (htmlparser2) with no DOM dependency,
// so it behaves identically in Node and Cloudflare Workers — no jsdom/linkedom
// shims or per-environment builds required. It must never be imported from
// client code (see sanitize.ts) — this module is imported from a server entry
// point (env/server.ts) instead.

const ALLOWED_TAGS = [...sanitizeHtml.defaults.allowedTags, "img"];

registerSanitizer((dirty) =>
  sanitizeHtml(dirty, {
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: ALLOWED_TAGS,
  }),
);
