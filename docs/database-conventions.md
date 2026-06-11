# Database Conventions (Drizzle ORM & Kysely)

This document outlines the conventions and best practices for database interactions within the ViteSakuga project, utilizing Drizzle ORM and Kysely.

---

## Location

- Drizzle ORM table schemas: `src/lib/db/schema/` (auth tables in `auth.schema.ts`, domain tables in `sakuga.schema.ts`)
- Drizzle Kit migration files: `src/db/drizzle/` (auto-generated SQL and metadata)
- Database configuration: `src/lib/db/pool.ts` (Neon serverless), `src/lib/db/kysely.ts` (Kysely setup)

## Kysely Client

- Raw Kysely instance in `src/lib/db/kysely.ts` using Neon `PostgresDialect`
- `DB` type derived from Drizzle schema definitions via `Kyselify`
- Effect wrapper via `KyselyDB` context tag in `src/lib/db/context.ts` — all domain services inject this
- EffectKysely utility (`src/lib/effect/effect.utils.ts`) adapts Kysely queries into Effect programs with `SqlError` and `SqlNoFirstResult` tagged errors

## Drizzle Schemas

- Drizzle ORM table definitions in `src/lib/db/schema/`
- Barrel re-export from `src/lib/db/schema/index.ts`
- Zod insert/select schemas auto-generated via `drizzle-zod` in `sakuga.utils.ts` and `auth.schema.ts`
- Used for Kysely type inference (not for query building — domain services use raw Kysely)

## Effect Layer Pattern

- All database access flows through `KyselyDB` Effect context tag
- Layer factories in `src/lib/db/layer-factories.server.ts`:
  - `makeDBLayer()` — provides `KyselyDB` + logging + tracing
  - `makeAuthLayer()` — provides `KyselyDB` + `AuthService` + `RequestHeadersService`
  - `makeMiddlewareLayer()` — resolves headers from request context
- Test layer via `PGliteDialect` (`src/lib/db/pglite-driver.ts`) and `makeServiceTestLayer` in test utils
- E2E test layer via `createE2EKysely` in `src/lib/db/e2e-db.ts` (runs Drizzle migrations against in-memory PGlite)

## Migrations

- Follow Drizzle Kit migration workflow (`pnpm db generate`, `pnpm db push`, `pnpm db migrate`)

## TanStack DB Collections

- Client-side collections in `src/lib/db/collections.ts` using `@tanstack/react-db` and `@tanstack/query-db-collection`
- Sync server data into reactive collections: `tagsCollection`, `usersCollection`
- Local storage collections for drafts: `commentDraftsCollection`, `uploadDraftCollection`
