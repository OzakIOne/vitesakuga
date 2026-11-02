# Database Conventions (Drizzle ORM & Kysely)

This document outlines the conventions and best practices for database interactions within the ViteSakuga project, utilizing Drizzle ORM and Kysely.

---

## Location

- Drizzle ORM table schemas: `src/lib/db/schema/` (auth tables in `auth.schema.ts`, domain tables in `sakuga.schema.ts`)
- Drizzle Kit migration files: `drizzle/` at the repo root (timestamped folders with auto-generated SQL, snapshots, and journal)
- Database configuration: `src/lib/db/pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`), `src/lib/db/kysely.ts` (Kysely setup)

## Kysely Client

- Raw Kysely instance in `src/lib/db/kysely.ts` using Kysely `PostgresDialect` over the pool from `pool.ts` (local `pg` when `DATABASE_DRIVER=local`) or `NeonTransactionDialect` (Neon serverless)
- Better Auth runs on `authKysely`, a second raw Kysely over the same dialect. `makeFromKysely` replaces `transaction()` on the shared `kysely` instance with the Effect API, which Better Auth's adapter cannot use. Never hand the shared `kysely` to Better Auth or any other library that calls Kysely's own `transaction()`
- The side-effect-free `makeAuth` factory lives in `src/lib/auth/index.ts`; `src/lib/auth/instance.ts` constructs the process-wide instance. Tests that inspect auth configuration should use the factory with their own database rather than importing the singleton. Better Auth 1.7.14 starts Kysely schema validation asynchronously as its auth context initializes. Its Postgres check reads the effective search path, then Kysely introspection; failed connectivity is logged as a generic validation warning.
- Username generation for sign-ups checks availability through Better Auth's current transaction adapter (`getCurrentAdapter`), so a sign-up never waits on a connection its own transaction holds
- `DB` is derived from the Drizzle tables by `KyselyTable` in `src/lib/db/kysely-schema.ts`: select types come from `$inferSelect`, and a column whose Drizzle definition has a default (`hasDefault`, including `$defaultFn`) is `Generated`, so it is optional on insert. `posts.version` and `post_edits.basePostVersion` support optimistic concurrency checks
- Effect wrapper via `KyselyDB` context tag in `src/lib/db/context.ts` — all domain services inject this
- `media_operations` and `media_objects` form the durable lifecycle registry. Mutations run through `LifecycleService.runOperation`, which claims a user-scoped operation key, persists a request fingerprint and fence, and replays terminal results decoded by a per-kind result schema. Object deletion uses durable `deleting`/`deleted` tombstones; remote storage I/O happens only after the database transition commits.
- Lifecycle timestamps in these tables use PostgreSQL `timestamp with time zone` and represent instants. Pass and compare JavaScript `Date` values directly; never compensate for the process timezone with manual offsets.
- Lifecycle integration lives in `src/lib/lifecycle/lifecycle.service.ts`; inside the caller's short transaction, call the bound `operation.finish(trx, result)` alongside post/reference writes (or `updatePostWithVersionInTransaction` / `swapPostVideoInTransaction` for version CAS). Never hold that transaction open during R2/RustFS calls.
- `makeFromKysely` in `src/lib/db/effect-kysely.ts` adapts Kysely queries into Effect programs with SQLSTATE-classified `SqlError` and `SqlNoFirstResult` errors
- Use `db.transaction((trx) => effect)` for transactions. Transaction callbacks receive Effect query helpers, nested `trx.savepoint(label, callback)` calls roll back independently, and `trx.afterCommit(effect)` schedules work only after commit. Transaction options support access mode, isolation level, and bounded retries for retryable begin failures.

## Drizzle Schemas

- Drizzle ORM table definitions in `src/lib/db/schema/`
- Barrel re-export from `src/lib/db/schema/index.ts`
- Effect Schema insert/select schemas defined in `sakuga.utils.ts` and `auth.schema.ts`
- Used for Kysely type inference (not for query building — domain services use raw Kysely)
- Domain tables include `tags`, `posts`, `postImages`, `postTags`, `tagFollows`, `postVotes`, `postReports`, `playlists`, `playlistPosts`, `comments`, `commentMentions`, `pointsLedger`, `promotionReviews`, `accountModerationEvents`, `notifications`, `postEdits`, `postEditApprovals`, `videoRevisions`, `mediaOperations`, and `mediaObjects`
- `account_moderation_events` is an append-only transaction companion to role and suspension updates. Its actor and target FKs are nullable with `ON DELETE SET NULL`; account deletion anonymizes the user row, preserving the links, while a physical row deletion clears only the reference and never removes the history event.

## Adding a Table or Column

- Define the table or column in `src/lib/db/schema/`. Do not hand-write a Kysely type: `DB` follows the Drizzle table automatically.
- The Drizzle TS key must equal the database column name. `src/lib/db/schema/column-names.test.ts` enforces this, so write `created_at: timestamp()`, not `createdAt: timestamp("created_at")`.
- Declare the real database default in Drizzle (`.defaultNow()`, `.default(...)`), so the type reflects it. A `$defaultFn` also makes the column optional on insert, but it sets no database default.
- Narrow text and JSON columns with `.$type<T>()` (for example `.$type<Role>()`, `.$type<PostEditPayload>()`), so the type never widens to `string`. For JSON columns, use the parsed JSON value shape and pass objects to database writers; stringify only for textual transports such as multipart `FormData`, then parse and validate received JSON with its domain schema.
- Declare database invariants in the Drizzle table's extra config with `check(...)`; `user.role` is checked against `RoleSchema.literals` and keeps its `'novice'` default.
- A migration that sets a default by hand must also be recorded in the latest `drizzle/*/snapshot.json`. Otherwise `nub run db generate` emits a migration that is already applied.
- `nub run db generate` must print `No schema changes` after a type-only or `$defaultFn` change. Add type-level expectations to `src/lib/db/kysely-schema.type-test.ts` when a precise type matters.

## Effect Layer Pattern

- All database access flows through `KyselyDB` Effect context tag
- Layer factories in `src/lib/db/layer-factories.server.ts`:
  - `makeDBLayer()` — provides `KyselyDB` + `StorageLive` + logging + tracing (uses PGlite when `DATABASE_DRIVER=pglite`)
  - `makeAuthLayer()` — provides `KyselyDB` + `AuthService` + `RequestHeadersService`
  - `makeMiddlewareLayer()` — resolves headers from request context
- Test layer via `PGliteDialect` (`src/lib/db/pglite-driver.ts`), `makeServiceTestLayer` in test utils (includes RustFS storage), and `createE2EKysely` in `src/lib/db/e2e-db.ts` — service tests use in-memory PGlite and migrations from root `drizzle/`; e2e uses local Postgres + RustFS through the Playwright web server

## Durable Media Lifecycle

- `LifecycleService` owns the managed media protocol: operation fences, object reservation/preparation, storage writes or copies, readiness, and deletion tombstones.
- Remote S3 calls stay outside database transactions. Video replacement copies first, then commits media readiness, the previous-video revision, the Post version compare-and-swap, and operation completion in one transaction.
- `deleteObject` checks live Post, gallery-image, and revision references while acquiring the delete fence. If remote deletion fails or its response is uncertain, the object remains `deleting`; `reconcileNonTerminal` safely retries the idempotent delete. Uncertain writes remain reconcilable from verified storage metadata.
- Callers keep their authorization and request validation at the domain service boundary; they do not sequence lifecycle transitions or delete managed keys directly.

## Migrations

- Follow Drizzle Kit migration workflow via `nub run db generate`, `nub run db push`, `nub run db migrate` (stage-aware: `STAGE=local|dev|prod nub run db <command>`)

## TanStack DB Collections

- Client-side collections in `src/lib/db/collections.ts` using `@tanstack/react-db` and `@tanstack/query-db-collection`
- Sync tag data into a reactive collection: `tagsCollection`
- Load the public user directory through its server route loader so `/users` is
  present in the initial SSR response; do not duplicate that list in a browser-only
  collection.
- Local storage collections for drafts: `commentDraftsCollection`, `uploadDraftCollection`
