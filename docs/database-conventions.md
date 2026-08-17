# Database Conventions (Drizzle ORM & Kysely)

This document outlines the conventions and best practices for database interactions within the ViteSakuga project, utilizing Drizzle ORM and Kysely.

---

## Location

- Drizzle ORM table schemas: `src/lib/db/schema/` (auth tables in `auth.schema.ts`, domain tables in `sakuga.schema.ts`)
- Drizzle Kit migration files: `drizzle/` at the repo root (timestamped folders with auto-generated SQL, snapshots, and journal)
- Database configuration: `src/lib/db/pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`), `src/lib/db/kysely.ts` (Kysely setup)

## Kysely Client

- Raw Kysely instance in `src/lib/db/kysely.ts` using Kysely `PostgresDialect` over the pool from `pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`)
- `DB` type derived from Drizzle schema definitions via `Kyselify`
- Effect wrapper via `KyselyDB` context tag in `src/lib/db/context.ts` — all domain services inject this
- EffectKysely utility (`src/lib/effect/effect.utils.ts`) adapts Kysely queries into Effect programs with `SqlError` and `SqlNoFirstResult` tagged errors

## Drizzle Schemas

- Drizzle ORM table definitions in `src/lib/db/schema/`
- Barrel re-export from `src/lib/db/schema/index.ts`
- Effect Schema insert/select schemas defined in `sakuga.utils.ts` and `auth.schema.ts`
- Used for Kysely type inference (not for query building — domain services use raw Kysely)
- Domain tables: `tags`, `posts`, `postTags`, `postVotes`, `playlists`, `playlistPosts`, and `comments`

## Effect Layer Pattern

- All database access flows through `KyselyDB` Effect context tag
- Layer factories in `src/lib/db/layer-factories.server.ts`:
  - `makeDBLayer()` — provides `KyselyDB` + `StorageLive` + logging + tracing (uses PGlite when `DATABASE_DRIVER=pglite`)
  - `makeAuthLayer()` — provides `KyselyDB` + `AuthService` + `RequestHeadersService`
  - `makeMiddlewareLayer()` — resolves headers from request context
- Test layer via `PGliteDialect` (`src/lib/db/pglite-driver.ts`), `makeServiceTestLayer` in test utils (includes rustfs storage), and `createE2EKysely` in `src/lib/db/e2e-db.ts` — both run Drizzle migrations from root `drizzle/` against in-memory PGlite

## Migrations

- Follow Drizzle Kit migration workflow via `nub run db generate`, `nub run db push`, `nub run db migrate` (stage-aware: `STAGE=local|dev|prod nub run db <command>`)

## TanStack DB Collections

- Client-side collections in `src/lib/db/collections.ts` using `@tanstack/react-db` and `@tanstack/query-db-collection`
- Sync server data into reactive collections: `tagsCollection`, `usersCollection`
- Local storage collections for drafts: `commentDraftsCollection`, `uploadDraftCollection`
