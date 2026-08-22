# Security Audit — ViteSakuga (2026-08-21)

**Scope:** auth/session handling, server function authorization, SQL surface, upload pipeline, storage, secrets, security headers, dependencies, infra config.

**Overall verdict:** 🟢 **Strong posture.** Layered defenses, validated env, consistent ownership guards. Findings below are mostly hardening gaps rather than exploitable holes; three deserve prompt attention.

---

## ✅ Strengths

| Area          | Evidence                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets       | `.env*` gitignored, never committed in history; schema-validated env (`src/lib/env/defs.ts`) with `Redacted` secret types; OAuth creds _required_ in prod                                                                         |
| Sessions      | Verified server-side via Better Auth against real request headers (`getRequestHeaders()`); `disableCookieCache: true` = instant revocation; DB-backed rate limits with per-path brute-force rules (`src/lib/auth/index.ts:70-75`) |
| Authorization | Ownership guard applied on every mutation: posts update, comments delete, votes set/remove, all playlist writes (`ForbiddenError` on owner mismatch)                                                                              |
| SQL           | Zero raw SQL; all queries parameterized via Kysely; orderBy columns/directions from literal unions only                                                                                                                           |
| Headers       | Hash-allowlisted CSP in prod, HSTS, XCTO, XFO:DENY, COOP/CORP, permissions-policy (`nitro.config.ts:68-82`)                                                                                                                       |
| CSRF          | No custom `src/start.ts` → TanStack Start's auto CSRF middleware active for server fns; Better Auth origin checks + SameSite cookies                                                                                              |
| XSS           | No `dangerouslySetInnerHTML` anywhere; React escapes all user content                                                                                                                                                             |
| Storage keys  | `${namespace}/${userId}/${uuid}.${ext}` — session-derived userId, whitelisted video extensions → no traversal/overwrite                                                                                                           |

---

## 🔴 High priority

### H1 — Unbounded uploads buffered in Worker memory — ✅ FIXED (`d932a99`)

- No size limit anywhere (client, schema, server fn, storage); `src/lib/storage/storage.s3.ts:49-69` buffers the whole file (`file.arrayBuffer()`) before `PutObjectCommand`.
- Any authenticated user can OOM the Cloudflare Worker (128 MB) with one crafted request → trivial DoS + cost amplification.
- **Fix:** size refines on `VideoFile` / thumbnail schemas (`posts.schema.ts`), reject early in validator; consider presigned PUTs direct-to-R2 so bytes never transit the worker.

### H2 — Thumbnails accepted with zero validation → attacker content on `media.ozaki.one` — ✅ FIXED (`d932a99`)

- `posts.schema.ts:78`: thumbnail is `Schema.instanceOf(File)` — no type/ext/magic-byte/size check; client-supplied `Content-Type` stored verbatim (`storage.s3.ts:66`) on a publicly served bucket.
- Attacker can host arbitrary HTML/JS on your own media subdomain → phishing on trusted domain, tracking pixels, `Sec-Fetch-Site: same-site` requests toward the app (CSRF launchpad if checks ever weaken), cookie-tossing.
- **Fix:** validate thumbnails like videos (ext + size + magic bytes); force `Content-Type: image/jpeg` server-side; serve media bucket with locked-down CSP (`sandbox` / `default-src 'none'`) or `Content-Disposition`.

### H3 — E2E auth-bypass backdoor compiled into non-prod deployments

- `src/lib/auth/session.effect.ts:36-40`: synthetic session for cookie `e2e-test-auth=bypass`, runtime-gated on `MODE !== "production"` && `DATABASE_DRIVER === "pglite"` && `NODE_ENV !== "production"`.
- Dev stage (`sakuga-dev.ozaki.one`) builds with `--mode development` → first gate passes in production infra; only `DATABASE_DRIVER` separates that deployment from full auth bypass (`layer-factories.server.ts:16` also swaps the whole DB on that var).
- **Fix:** build-time constant (`import.meta.env.VITE_E2E_MODE`, dead-code eliminated in all deployed builds) instead of runtime env checks.

---

## 🟡 Medium priority

- **M1 — Bypassable regex sanitizer** (`src/lib/sanitize.ts`): misses unquoted handlers (`<img src=x onerror=alert(1)>`), SVG/MathML vectors. Mitigated by React escaping (content never rendered as HTML). Ironically `isomorphic-dompurify` is in `package.json` but never imported. Either sanitize with DOMPurify or delete the dep and rely on React escaping + CSP.
- **M2 — Account deletion leaks storage & content**: `user.deleteUser.enabled` but nothing cascades posts/comments/votes or R2 objects; orphaned videos stay publicly fetchable forever. Privacy/GDPR exposure. Add deletion hook with content + storage cleanup.
- **M3 — Dependency advisories (48)**: runtime-relevant: `ws < 8.21` (**high**, DoS) + `< 8.20.1` memory disclosure via `better-auth → @libsql/client`; `valibot ≤ 1.4.1` (moderate) via drizzle-orm; `diff` (low). Rest (`hono`, `sharp`, `lodash`, `extract-zip` highs) are devDependencies only (build-machine risk). Run `nub update` / add overrides, re-run `nub audit`.
- **M4 — Email verification not required**: accounts bound to unowned emails → reset ambiguity, spam signups. Enable verification plugin (OTP rate-limit rule already exists).
- **M5 — Search DoS knobs** — ✅ FIXED (`d932a99`): ILIKE `%`/`_` unescaped (`posts.service.ts:150-158`), no length caps on `q` / `tags` arrays → cheap full-scan amplification. ~~Escape wildcards, cap lengths at schema level.~~ → `escapeLikePattern` applied to every ILIKE site; shared caps (`q` ≤ 100, ≤ 20 tags, tag name ≤ 50) enforced in posts + users schemas.

## 🟢 Low priority

- **L1** — In-memory rate-limit fallback trusts spoofable `x-forwarded-for` (`rate-limit.middleware.ts:52-56`); fine behind Cloudflare (`cf-connecting-ip` wins); document as dev-only.
- **L2** — `docker-compose.yml` binds Postgres :5432, rustfs :9000-9001 (default creds) on `0.0.0.0`; bind to `127.0.0.1`.
- **L3** — Non-prod CSP `script-src 'unsafe-inline'`; `img-src https:` allows user-supplied image hosts (tracking pixels) — documented tradeoffs, acceptable.
- **L4** — No media lifecycle (no post deletion, no GC job) — pairs with M2. **Updated 2026-08-22:** the presigned direct-to-R2 flow adds a new orphan window — a video PUT to R2 whose confirm call (`uploadPost`) never runs (tab closed, validator rejection on title/tags/thumbnail) leaves an unreferenced object in the bucket forever. See "Orphaned presigned uploads" below.
- **L5** — Password policy min 8 (= Better Auth default) — ✅ **FIXED (2026-08-22)**: `MIN_PASSWORD_LENGTH = 12` shared by client schemas (`auth.schemas.ts`), the UI strength meter (`password-input.tsx`) and the server (`emailAndPassword.minPasswordLength` + `hooks.before` strength gate on `/sign-up/email`, `/change-password`, `/reset-password` in `auth/index.ts`, via new `password-policy.ts`). Server no longer trusts the client: character-class diversity (≥ 3 of lowercase/uppercase/digits/symbols) is enforced at every password-set endpoint.

---

## Action plan (suggested order)

1. ~~**H1 + H2** — one PR: upload schema refines (size/type both files), server-set Content-Type.~~ ✅ Done (`d932a99`), went further: presigned PUTs direct-to-R2.
2. **H3** — build-time e2e flag. Small change, removes the scariest footgun.
3. ~~**M3** dependency bumps + **M5** input caps~~ — M5 ✅ done (`d932a99`); M3 still open.
4. **M1 / M2 / M4** — design decisions: DOMPurify vs removal, deletion cascade, email verification.
5. ~~**L5** — password policy 12+ with server-side strength check.~~ ✅ Done (2026-08-22).

---

## Orphaned presigned uploads (follow-up to H1 fix, feeds L4)

### The two-step lifecycle

The H1 fix changed uploads from one step to two:

```
1. createVideoUploadUrl  →  server mints presigned PUT (valid 15 min)
2. browser PUTs bytes    →  object NOW EXISTS in R2   ← nothing in DB yet
3. uploadPost (confirm)  →  head-check + DB rows created
```

The problem: the rollback logic (`Exit.isFailure` → `deleteFile(uploadedKeys)`)
lives **inside step 3's handler**. If execution never reaches that handler,
whatever landed in R2 at step 2 stays there forever with zero DB references.

### The two leak windows

1. **PUT succeeds, confirm never runs.** User closes the tab mid-submit,
   network drops, laptop sleeps, or they abandon a slow upload after the video
   PUT finished but before form submission.
2. **Validator rejection at confirm (the subtle one).** The confirm validator
   runs `assertThumbnailIsJpeg`, schema parsing and JSON decoding _before_ the
   handler. If any of those throws, TanStack Start returns the error without
   invoking the handler — so the cleanup branch never executes, yet the video
   is already sitting in R2. An attacker (or clumsy user) can trigger this
   reliably: PUT a valid video, then submit garbage fields on purpose.

Note this window is genuinely new: pre-fix, both files were uploaded inside
the handler, so rollback always covered them.

### Why it matters

- **Silent cost growth** — no dashboard shows these; only the bucket bill does.
- **The size cap does not apply at PUT time** — `isUploadedVideoValid` runs at
  confirm. A malicious user can mint a URL, PUT a multi-GB object, and never
  call confirm; the 200 MB limit never fires.
- **Privacy residue** — users who saw "upload failed" believe the content is
  gone; it remains publicly fetchable via its UUID key (unguessable, but the
  URL transited the uploader's browser).

### Recommended fix

**Staging prefix + R2 lifecycle rule** — the classic S3 pattern, zero cron:

1. Presign into a pending namespace: `videos/_pending/{userId}/{uuid}.{ext}`
2. At confirm: copy the object to its final key
   `videos/{userId}/{uuid}.{ext}`, delete the pending one (same-bucket copy is
   cheap)
3. Attach an R2 lifecycle rule expiring everything under `_pending/` after
   24–48 h → the bucket garbage-collects orphans itself, and the rule also
   bounds how long an oversized unconfirmed object can live

Alternative: a Cron Trigger GC job that lists objects under `videos/` older
than N hours and deletes keys absent from `posts.videoKey` — works without
changing the key scheme, but needs paginated listing against a growing bucket.
