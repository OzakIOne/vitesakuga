# Effect Testing Practices Review

Source session: `ses_f96e1e94effe78mzvJmAqHVtBt` — "Improving Effect Testing Practices".
Window: 2026-09-03 21:12 → 2026-09-04 15:00, `build` agent + 10 `general` subagents.
Tracker: `docs/testing-improvements.md:1`.
Claimed result: 433 → 520 tests (+87), 44 → 49 files, final `vitest run --maxWorkers=1` 520/520.
Review mode: read-only, no fixes applied, full suite not re-run.

## Scope

Initial prompt was "find ways to improve testing", executed as 20-task implementation (T1–T20).

Session-owned changes:

- Harness: `vitest.setup.ts:75` `runSync` → `await runPromise`; `src/lib/db/test-utils.ts:64` scoped `trackStorageKeys` + `close()` + generic `testLayer`/`runEffect`/`runExit`; new `src/lib/auth/session.fixture.ts:19` `makeSessionUser`/`makeAuthSession`.
- Product: `src/lib/points/points.service.ts:46` Clock-driven local midnight; `src/lib/server-fn.handler.ts:33` `toClientSafeError` + per-request `debugId`.
- Tests: 5 new suites (`notifications.service.test.ts`, `reports.service.test.ts`, `moderation.service.test.ts`, `server-fn.handler.test.ts`, `rate-limit.middleware.test.ts`), expanded `effect.utils.test.ts`, `schema.utils.test.ts`, `points.service.test.ts`, `storage.test.ts`, `posts/comments/playlists/votes` typed assertions, `posts.schema.test.ts:4` real sanitizer import.

Unrelated pre-existing dirty files in the same `git diff` (not session work): `playlists.hooks.ts`, `account.tsx`, `account_.playlists.$playlistId.tsx`, `PlaylistPostsTable.tsx`, `sakuga.schema.ts`, `delete-account.ts`, `comments.service.ts`, `posts.schema.ts`, `e2e/*`, `package.json`. This review covers only session files.

## Done well

- `src/lib/db/test-utils.ts:69` delta-delete (never bucket wipe) is parallel-worker safe; `baseline.add(key)` before delete avoids double-delete.
- `src/lib/server-fn.handler.ts:51` pass-through by identity (`toBe` in test) + `ValidationError` cause-strip is correct boundary; `src/lib/server-fn.handler.test.ts:38` UUID pattern assert is precise.
- `src/lib/effect/effect.utils.test.ts:80` rollback identity (`toBe(failure)`) + `SqlError` cause/message asserts are non-tautological.
- `src/lib/auth/session.fixture.ts:12` documents why `role` intersection exists; removes 12 suites of `as unknown as` doubles.

## Findings

- Major — `src/lib/points/points.service.test.ts` T12 pattern (`ALTER TABLE … DROP COLUMN`, restore after): if assertion throws before restore, ledger stays broken for later tests in same PGlite. No `try/finally` / `acquireUseRelease` visible in tracker notes. Fragile by construction.
- Major — `src/lib/points/points.service.ts:50` midnight math `now - intoDay` assumes `toParts` wall-time maps linearly to epoch. Equivalent to old `setHours(0,0,0,0)` in normal days, unverified on DST transition (23/25h days). No DST test; TestClock tests compute expectations from clock value, so they cannot catch offset error.
- Major — `src/lib/storage/storage.test.ts` T20 1001-object pagination + poll-until-stable + 240s cleanup timeout: heaviest test in suite (~14s solo). Listing-index lag workaround is real, but makes full suite slow/flaky under load.
- Minor — `docs/testing-improvements.md:35` T6 status still `in-progress` while completion notes claim "all 20 done". Tracker inaccurate.
- Minor — `src/lib/auth/session.fixture.ts:48` `expiresAt: new Date(Date.now() + …)` non-deterministic; fixed `createdAt: 2026-01-01` is now in the past relative to test run. Fine today, will drift.
- Minor — `src/lib/rate-limit/rate-limit.middleware.test.ts` uses confined `vi.doMock` + `resetModules`; violates repo "no mocking / prefer Layer doubles" convention. Justified (module-scoped limiter), documented, but is a seam.
- Nit — `src/lib/server-fn.handler.ts:54` `isTaggedError: "_tag" in error` false-positives on any `Error` with `_tag` prop; acceptable at I/O boundary, but allowlist check happens after.

## Product-behavior questions (tested as implemented, need human decision)

- `moderation.service.test.ts` invalid role → `ForbiddenError`, not `ValidationError`; unknown target → success no-op.
- Middleware sends `x-retry-after`, not `Retry-After`.
- `comments.fn.test.ts` missing post → `SqlError` (FK, no pre-check).

## Verification

Did not re-run suite (152s full run claimed green in tracker `docs/testing-improvements.md:101`). Spot-read diffs only; no files modified.
