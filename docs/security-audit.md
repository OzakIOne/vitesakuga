# Security Audit — ViteSakuga

This document keeps the security findings from the 2026-08-21 audit as a
current status record. It is not a substitute for a fresh audit; verify claims
against the current code before relying on them.

## Current status — 2026-09-06

| Finding                                            | Status                                  | Current evidence / follow-up                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 — Unbounded uploads buffered in the Worker      | **Mitigated**                           | Videos use presigned PUTs to the staging namespace and are checked at confirm time. Thumbnails and images remain server-side and are size-limited by `src/lib/posts/posts.schema.ts`. Keep the 200 MiB video and 5/10 MiB thumbnail/image limits covered by tests.                                          |
| H2 — Unvalidated thumbnails                        | **Mitigated**                           | JPEG extension, size, and magic-byte validation are applied before storage; storage forces the thumbnail content type. See `src/lib/posts/file-validation.ts` and `src/lib/storage/storage.adapter.ts`.                                                                                                     |
| H3 — E2E auth bypass reaching a deployment         | **Mitigated by runtime gates**          | The bypass requires `DATABASE_DRIVER=e2e`, non-production `NODE_ENV`, a non-production Vite mode, and a recognized `e2e-test-auth` cookie. The Playwright web server is the only configured e2e environment. Deployment envs do not set the e2e driver. Keep this gate covered by e2e/configuration review. |
| M1 — Bypassable sanitizer                          | **Fixed**                               | `sanitize-html` is used through `src/lib/sanitize.ts`; `src/lib/sanitize.server.ts` registers the server implementation. Regression coverage is in `src/lib/sanitize.test.ts`.                                                                                                                              |
| M2 — Account deletion leaks content or credentials | **Fixed by product decision**           | `src/lib/auth/delete-account.ts` anonymizes the user row, removes credentials/sessions and personal playlists, and keeps public posts/comments/votes attributed to `Deleted user`.                                                                                                                          |
| M3 — Dependency advisories                         | **Recheck when dependencies change**    | Runtime-facing dependency upgrades landed, but the audit's dependency counts are historical. Run the repository's current dependency audit rather than copying the old count.                                                                                                                               |
| M4 — Email verification not required               | **Fixed**                               | New accounts must use an approved provider domain and complete a Better Auth email OTP before a session is created. OTPs are hashed, expire after 10 minutes, and allow five attempts. Delivery is configured through Cloudflare Email Service. |
| M5 — Search wildcard / input amplification         | **Fixed**                               | Search wildcards are escaped and shared limits cap query length, tag count, and tag length (`src/lib/search/search-limits.ts`, `src/lib/posts/posts.schema.ts`, `src/lib/users/users.schema.ts`).                                                                                                           |
| L1 — Spoofable forwarded IP in fallback limiter    | **Accepted with deployment constraint** | Cloudflare's `cf-connecting-ip` takes precedence in deployment; the in-memory fallback is for local/test use and must not be treated as a production distributed limiter.                                                                                                                                   |
| L2 — Local Docker ports exposed on all interfaces  | **Local hardening follow-up**           | Review `docker-compose.yml` before using the local stack on an untrusted network; default local credentials are not production credentials.                                                                                                                                                                 |
| L3 — Non-production CSP allowances                 | **Accepted for development**            | Non-production CSP allows inline scripts and user-supplied HTTPS images for framework and profile-image behavior. Production uses a hash allowlist for scripts.                                                                                                                                             |
| L4 — Orphaned presigned uploads                    | **Fixed**                               | Pending video objects use `videos/_pending/`, are promoted only after validation, and expire through the R2 lifecycle rule in `infra/alchemy.run.ts`.                                                                                                                                                       |
| L5 — Weak password policy                          | **Fixed**                               | Minimum length and character-class checks are enforced server-side in `src/lib/auth/index.ts` through `src/lib/auth/password-policy.ts`.                                                                                                                                                                    |

## Current controls

- Better Auth sessions are fetched with request headers and cookie caching is disabled for session reads.
- Mutating services require authentication and apply ownership or role/permission checks.
- Server-function failures are logged with a debug ID and sanitized by
  `src/lib/server-fn.handler.ts`; database and internal errors are not sent to
  clients verbatim.
- User input is validated with Effect Schema, comments and editable text are
  sanitized, and SQL values are parameterized through Kysely. The post-search
  service uses constrained Kysely `sql` expressions for numeric comparisons;
  this is not an unparameterized raw-SQL surface.
- Production response headers are defined in `nitro.config.ts`: CSP, HSTS,
  `nosniff`, frame protection, referrer policy, permissions policy, COOP, and
  CORP.
- Storage keys are namespaced by the authenticated user and generated with
  unpredictable UUIDs. Image/video extensions and content types are derived or
  checked server-side.

## Open decisions before launch

1. Provision and verify the Cloudflare Email Service sender domain, API token,
   and `EMAIL_FROM` before the first production deployment. Confirm SPF, DKIM,
   DMARC, bounce handling, and the provider allow-list against product policy.
2. Re-run dependency and infrastructure audits against the versions actually
   installed at release time.
3. Review local Docker bind addresses and credentials for the intended developer
   workflow.
4. Revisit accepted CSP and fallback-rate-limiter tradeoffs if the deployment
   topology changes.
