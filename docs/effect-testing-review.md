# Effect Testing Improvements — Review

Review of OpenCode session `ses_f96e1e94effe78mzvJmAqHVtBt` (“Improving Effect Testing Practices”).
Uncommitted working tree vs `HEAD` `4547951`. No commits in this effort. No fixes applied.

**Scope:** testing-practice files only. The working tree also contains unrelated dirty files (playlists UI, e2e, nitro, package.json, account routes, `comments.service.ts`, `server-fn.handler.ts` source, etc.) that are out of scope here.

**Spec sources:** the GPT Effect-test audit in that session, plus the task board in `docs/testing-improvements.md` (T1–T20). The user asked to improve each GPT finding and track the work in markdown for parallel subagents.

---

## Standards

No hard documented-standard breaches. Session `vi.fn`, per-file `insertUser`, and `*.fn.test.ts` names are pre-existing / match repo consistency. Unused `CommentNotFoundError` imports in `comments.fn.test.ts` would be tooling.

### Documented (judgement)

**AGENTS.md Testing — Avoid mocking.** New mock in `rate-limit.middleware.test.ts`:

```ts
vi.doMock("./rate-limiter", async (importOriginal) => {
  ...
  RateLimiterMemory: Layer.succeed(RateLimiter)({
    check: () => Effect.fail(new Error("redis connection lost")),
  }),
});
```

Also `vi.fn` Cloudflare `limit` stubs. Comment argues module-scoped limiter has no TestClock seam. Tracker prefers real PGlite/RustFS; this is the exception.

**AGENTS.md — type narrowing, not assertions.**

- `effect.utils.test.ts`: `(await flipFailure(...)) as SqlError` and `as { _tag?: string }` after `_tag` checks.
- `schema.utils.test.ts`: `(thrown as Error).message` after `toBeInstanceOf(Error)`.
- `rate-limit.middleware.test.ts`: `as unknown as MiddlewareEvent` (documented Nitro surface). Malformed-session casts in `auth.middleware.test.ts` are the remaining T8 exceptions.

**AGENTS.md — prefer `for...of` over indexed `for`.** New index loops: notifications (55), moderation (51), rate-limit middleware (60), storage (1001 + 15-attempt poll). Index is the seed payload.

### Smells (always judgement)

**Duplicated Code — `runFailure`.** Same helper copied:

```ts
const runFailure = <A, E>(effect: Effect.Effect<A, E>): Promise<E> =>
  runEffect(Effect.flip(effect));
```

in `account-security.test.ts`, `playlists.fn.test.ts`, `votes.fn.test.ts`. `effect.utils.test.ts` has `flipFailure`. New suites inline `Effect.flip`. Belongs on `makeServiceTestLayer`.

**Speculative Generality — unused `runExit`.** `test-utils.ts` exports `runExit`; no consumer. T6 uses flip, not Exit.

**Middle Man — `policy.test.ts`:**

```ts
const sessionUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => makeSessionUser(overrides);
```

**Duplicated Code — throw capture** in `schema.utils.test.ts` (`parse` / `parseStrict`): try/catch → `thrown as Error`.

---

## Spec

### (a) Missing / partial vs GPT audit

**Dropped entirely (not in T1–T20; user asked to improve each GPT finding):**

- “Comments update failure/auth paths (unauthenticated update, others' comment, missing comment, mention swallow, deleted users, max mentions)” — `comments.fn.test.ts` still only has mention re-resolution happy paths.
- “Post-edits typed failures (EditNotFound, missing post, … concurrency, best-effort points/notif)” — no `EditNotFound` / missing-post / concurrency / swallow tests. Duplicate-approval is reject-after-approve, not a second approve.
- “Playlist validation/transaction (invalid reorder, dup positions, empty bulk, mid-op rollback, concurrent)” — reorder still only success + forbidden.
- “Posts search (date ranges, oldest, vote counts, popular-tag)” — search still `dateRange: "all"` / `sortBy: "newest"` only (popular-tag was pre-existing).
- “E2E global-setup swallows failures” — untouched (`Effect.catch` still in `e2e/global-setup.ts`).
- “Hardcoded IDs / module-global postSeq” — still in videos/post-edits; **new** `moderation.service.test.ts` adds `let postSeq = 0`.
- “void discards in post-edits/promotions/videos tests” — `void db` / `void secondVote` remain.
- Harness: “Separate helpers for db-only, db/auth, storage, full-stack”; “Init migrations once per worker/file, reset tables between tests” — still one `makeServiceTestLayer` that migrates a new PGlite every call.
- “Typed runExit helper” — added, never used (`T7` notes admit this).
- T6 table still `in-progress` (“rest pending”) while completion claims all 20 done.

**Partial:**

- “Prefer Effect.exit or Effect.flip over rejects.toThrow” — playlists/votes/etc. converted; `auth.middleware`, `delete-account`, `post-edits`, `promotions`, videos GC still `rejects.toMatchObject`.
- “Video GC preview assertions weak” — still `expect(Array.isArray(preview.orphanKeys)).toBe(true)`.
- “Unique storage namespace or clean RustFS after each test” — delta cleanup only; GC still sees shared-bucket leftovers.

### (b) Scope creep

- Extra rate-limiter cases (retryAfter, edge, key isolation) beyond “TestClock.layer() not real sleeps”.
- T20 `listKeys` pagination: 1001 uploads + poll-until-stable (not in audit).
- New moderation tests reintroduce `postSeq` (anti-pattern, not requested).

### (c) Looks done, implementation wrong

- P0 “RustFS objects not cleaned; GC deletes other tests' objects” / “Exact GC deletion/retention”: `deletedKeys` is `1 + baselineOrphans` — GC still deletes other runs’ orphans in the shared bucket; isolation is accounting, not containment.
- T5 “Unique per-test userIds skipped” contradicts that P0. Delta `cleanup()` never removes **baseline** orphans, so the next GC run still mutates them.

---

## Summary

Standards: 0 hard, 8 judgement — worst: duplicated `runFailure` (plus AGENTS.md mock exception in middleware).

Spec: ~16 missing/partial, 3 creep, 2 wrong — worst: P0 RustFS isolation is accounting, not containment.
