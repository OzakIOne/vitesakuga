# Review: Improving Effect Testing Practices

**Session:** `ses_f96e1e94effe78mzvJmAqHVtBt`

## Verdict

The testing effort improves coverage and resource cleanup, but it should not be considered complete or deterministic.

## Findings

1. **High: Typed test harness does not type-check**

   `src/lib/db/test-utils.ts:125-143` constrains service layers and effects to `never` requirements, although real services require dependencies such as `KyselyDB` and `StorageModule`.

   `tsc --noEmit` fails at callers including:

   - `src/lib/posts/posts.fn.test.ts:34`
   - `src/lib/videos/videos.service.test.ts:80`
   - `src/lib/promotions/promotions.service.test.ts:58`

   This contradicts `docs/testing-improvements.md:36`. Vitest does not catch the issue because it transpiles without type-checking.

2. **High: Storage cleanup is not parallel-worker safe**

   `src/lib/db/test-utils.ts:92-114` uses per-test baseline snapshots against a shared RustFS bucket.

   If two tests overlap, one cleanup can delete objects created by the other. This is especially dangerous because `VideosService.gcRun` treats objects absent from its test database as orphans.

   The claims in `docs/testing-improvements.md:34` and `:107-109` are incorrect.

3. **High: Daily-cap calculation is not DST-safe**

   `src/lib/points/points.service.ts:52-59` computes local midnight by subtracting local wall-clock fields from a UTC instant.

   Around DST transitions this differs from the previous `Date#setHours(0, 0, 0, 0)` behavior, causing earnings from an adjacent day to be counted or omitted.

   The tests reproduce the same flawed calculation at `src/lib/points/points.service.test.ts:165-173`.

4. **High: Server error boundary has bypasses**

   `src/lib/server-fn.handler.ts:95-108` only sanitizes failures already in the Effect error channel.

   The following can bypass logging, genericization, and debug-ID creation:

   - Synchronous throws from `effect(data)`
   - Defects from `Effect.die`
   - Layer construction failures
   - Rejections from `makeBase()`

   The tests at `src/lib/server-fn.handler.test.ts:87-123` only cover `Effect.fail`.

5. **High: Full-suite reliability remains flaky**

   `makeServiceTestLayer` creates a fresh PGlite instance and runs all migrations for every test (`src/lib/db/test-utils.ts:25-33,145`).

   Independent verification recorded:

   - Full sequential run: `518/520`, with two promotion-test timeouts
   - Targeted parallel execution: 7 timeouts
   - The affected promotion tests pass in isolation

   This contradicts the tracker's `520/520` deterministic completion claim.

6. **Medium: GC tests do not prove object deletion**

   `src/lib/videos/videos.service.test.ts:338-412` does not create actual RustFS objects for orphan detection.

   The `gcRun` test at `:424-468` uses nonexistent keys. Since S3 deletion succeeds for missing objects, a no-op `deleteFile` implementation could still pass.

7. **Medium: Cleanup can leak PGlite**

   `src/lib/db/test-utils.ts:162-167` closes PGlite only after storage cleanup succeeds.

   Any RustFS listing or deletion failure prevents `pg.close()`. Also, failures during tracker creation at `:145-150` can leak the already-created PGlite instance.

8. **Medium: Cleanup can leak objects through eventual-consistency gaps**

   `src/lib/db/test-utils.ts:104-114` performs one listing pass.

   The storage tests explicitly acknowledge listing lag at `src/lib/storage/storage.test.ts:300-310`, but cleanup does not retry or poll. Recently uploaded objects may remain in RustFS and pollute later tests.

9. **Medium: TestClock tests still depend on real wall-clock time**

   `src/lib/points/points.service.test.ts:160-172` initializes the Effect clock using `Date.now()`, while database rows use database `now()`.

   If execution crosses a local midnight boundary, the test clock and inserted row timestamps can disagree. The tests are not fully deterministic as documented.

10. **Medium: Moderation coverage does not test both queue limits**

    `src/lib/moderation/moderation.service.test.ts:217-246` only seeds and asserts the reports queue.

    A regression removing the pending-edit `.limit(50)` in `src/lib/moderation/moderation.service.ts:103-123` would still pass.

11. **Medium: Tracker completion claims are stale or inaccurate**

    `docs/testing-improvements.md` contains multiple inconsistencies:

    - T6 remains `in-progress` at line 35
    - T15 claims 11 tests at line 44, while the suite contains 10
    - Line 101 claims `520/520`
    - Lines 107-109 claim default parallelism no longer times out
    - Those claims are contradicted by later timeout results

12. **Minor: New lint warning**

    The added `crypto.randomUUID()` at `src/lib/server-fn.handler.ts:99` triggers an `effecttsgo/crypto-random-uuid` warning.

    Targeted lint reported 3 warnings and 0 errors, not the tracker's claimed zero warnings.

13. **Minor: `void` test-value discards remain**

    `docs/testing-improvements.md:20` forbids these discards, but they remain at:

    - `src/lib/post-edits/post-edits.service.test.ts:198`
    - `src/lib/post-edits/post-edits.service.test.ts:202`
    - `src/lib/post-edits/post-edits.service.test.ts:229`
    - `src/lib/promotions/promotions.service.test.ts:193`
    - `src/lib/promotions/promotions.service.test.ts:235`

14. **Minor: `runExit` is unused**

    `src/lib/db/test-utils.ts:126,160-161` adds `runExit`, but no test consumes it. The suites instead duplicate local `runFailure` helpers.

## Verification

- Targeted schema, storage, and video suites: `46/46` passed
- Targeted serialized suites: `63/63` passed
- Independent full-suite run: `518/520`
- Targeted parallel run: 7 timeouts
- Oxlint: 0 errors, warnings present
- TypeScript check: failed
- No fixes were made

## Positive Changes

- Real sanitizer registration was added.
- Effect failure assertions were strengthened with `_tag` and fields.
- New service coverage was added for notifications, reports, moderation, server-function handling, rate limiting, storage, and image uploads.
- PGlite cleanup was added to most service suites.
- The storage and image-upload tests exercise real RustFS behavior rather than mocks.
