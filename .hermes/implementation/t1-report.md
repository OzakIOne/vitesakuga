# T1 implementation report

## Outcome

Corrected the transaction bridge after review rejection. Caller interruption now
aborts the child Effect callback, while the Promise given to Kysely remains alive
until callback completion, transaction phase handling, and connection release
have settled. This removes the acknowledged-interruption path that previously
committed a later INSERT. No commit or push was performed.

The 27 pre-existing relevant tests were retained; one deterministic regression
test was added for non-SQL `Effect.promise` work.

## TDD evidence

- Baseline before correction: the existing suite reported 27 passed, but the two
  interruption tests asserted the defect (`rows.length === 1` and early
  settlement).
- RED after correcting those assertions first:
  - before `BEGIN` completed, the old bridge returned interruption early and the
    later callback committed one row instead of zero;
  - during non-cancellable SQL, the old bridge did not wait for the gated
    rollback/release path;
  - a callback suspended on non-SQL `Effect.promise` did not finish because the
    child had no parent abort signal.
- GREEN: after wiring the callback signal and an uninterruptible completion
  cleanup, the complete targeted suite passed with 28 tests.

## Correctness covered

- `Effect.callback((resume, signal) => ...)` passes the callback signal to
  `Effect.runPromiseExitWith(context)(..., { signal })`.
- The Kysely callback Promise is kept pending until Kysely has completed its
  transaction phases. `Effect.callback` cleanup waits for that Promise
  uninterruptibly, so rollback cannot race non-cancellable SQL and interruption
  is not observed before rollback/release.
- If interruption is acknowledged while acquisition/`BEGIN` is gated, the Effect
  callback is never started; `BEGIN`, rollback, and release still settle before
  the interrupt is returned.
- If interruption occurs during a gated SQL query, the query drains first, then
  rollback and release run, and the write is absent.
- A callback waiting on non-SQL `Effect.promise` is interrupted and does not run a
  later INSERT.
- Caller context, `R`, TestClock, parent span, callback causes, defects,
  rollback-error chaining, commit uncertainty, confirmed-commit release
  cleanup, and driver phase metadata remain covered.
- Cleanup rejection is absorbed by the cleanup waiter so it cannot mask the
  primary callback/interruption cause; cleanup failures are logged in an Effect
  rather than through an untracked fork.

## Verification

- `nub --no-env-file exec vitest run src/lib/effect/effect.utils.test.ts src/lib/db/pglite-driver.test.ts`
  — **28 passed, 2 files passed** (`25` effect-bridge tests, `3` PGlite driver
  tests).
- `nub --no-env-file exec oxfmt --check src/lib/effect/effect.utils.ts src/lib/effect/effect.utils.test.ts src/lib/db/pglite-driver.ts src/lib/db/pglite-driver.test.ts src/lib/db/neon-transaction-dialect.ts`
  — **passed**.
- Targeted `oxlint` on the five owned TypeScript modules — **passed**, no
  diagnostics.
- `nub --no-env-file exec tsc --noEmit --incremental false` — **passed**.
- No shared PostgreSQL/Neon or Workers runtime was used; the transaction tests
  use isolated in-memory PGlite.

## Files in the T1 ownership set

- `src/lib/effect/effect.utils.ts`
- `src/lib/effect/effect.utils.test.ts`
- `src/lib/db/pglite-driver.ts`
- `src/lib/db/pglite-driver.test.ts`
- `src/lib/db/neon-transaction-dialect.ts`
- `docs/database-conventions.md`
- `.hermes/implementation/t1-report.md`

The documentation now states the corrected guarantee: interruption aborts the
child callback but is observed only after the transaction phase and connection
release have settled. It no longer promises that callers can observe
`Interrupt` before the database transaction finishes.

## T2 contract

T2 may use `SqlError.stage` / `SqlError.outcome` to distinguish confirmed
commit, confirmed rollback, not-committed, and unknown outcomes. It must not
retry or destructively compensate a transaction whose commit outcome is
unknown; cleanup failure after `commit-confirmed` remains separate from business
failure.
