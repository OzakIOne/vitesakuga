/**
 * HTML sanitization boundary, safe to import from client code.
 *
 * `sanitize-html` (and its `postcss` dependency) reach for Node builtins
 * (`path`, `fs`, `url`) that cannot exist in the browser bundle, so the real
 * implementation lives in `sanitize.server.ts` and registers itself at server
 * boot. In the browser the sanitizer is a pass-through: client-side decodes
 * are advisory only — every server function re-decodes its input through the
 * same schemas, and the server's registered sanitizer strips dangerous HTML
 * before anything is persisted.
 */

type Sanitizer = (dirty: string) => string;

let impl: Sanitizer = (value) => value;

export function registerSanitizer(sanitizer: Sanitizer): void {
  impl = sanitizer;
}

export function sanitize(dirty: string): string {
  return impl(dirty);
}
