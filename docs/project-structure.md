# Project Structure & File Conventions

This document details the expected project structure and file conventions within the ViteSakuga project.

---

## Source Directory Layout

```
src/
├── components/   # Reusable React components
│   ├── form/     # Form field components (TanStack Form + Ark UI)
│   ├── PostDetail/ # Post-specific display/edit components
│   └── ui/       # UI primitives (provider, color-mode, toaster, etc.)
├── db/           # Legacy migration folder (see note below)
├── lib/          # Core feature modules, services, and infrastructure
│   ├── assets/   # Asset URL builder (R2 public URLs)
│   ├── auth/     # Better Auth configuration, middleware, hooks, schemas
│   ├── comments/ # Comments: service, hooks, queries, schemas, tests
│   ├── db/       # Kysely setup, Drizzle schemas, layer factories, pool, test utilities
│   │   └── schema/ # Drizzle ORM table definitions (auth + sakuga)
│   ├── effect/   # Effect wrappers (EffectKysely, logger, tracing, schema utils)
│   ├── env/      # Environment validation (client + server + shared defs)
│   ├── mutations/ # Shared mutation feedback (toasts, error messages)
│   ├── pagination/ # Pagination computation utility
│   ├── playlists/ # Playlists: service, hooks, queries, schemas, tests
│   ├── posts/    # Posts: service, hooks, queries, schemas, utils, tests
│   ├── storage/  # R2/S3 + rustfs storage modules (Effect service + impls + tests)
│   ├── tags/     # Tags: service, queries, utils, tests
│   ├── upload/   # Client-side upload processing: video analysis, thumbnails, hooks
│   ├── users/    # Users: service, queries, schemas, tests
│   └── votes/    # Post votes: service, hooks, queries, schemas, utils, tests
├── routes/       # TanStack Router file-based routes
├── styles/       # Global CSS (Tailwind v4 entry point)
└── utils/        # Utility functions (SEO meta tags)
```

> Drizzle Kit migrations are auto-generated into the repo-root `drizzle/` directory (timestamped folders, per `drizzle.config.ts`). `src/db/drizzle/` is a legacy leftover containing only the original 0000 migration; it is not referenced by code or tooling.

**Key files at `src/lib/` root:**

- `errors.ts` — Effect `Schema.TaggedError` domain error classes
- `mutations/mutation-feedback.ts` — Shared mutation feedback (`useMutationWithFeedback`, `toastError`/`toastSuccess`, `errorMessage`)
- `query-client.ts` — Singleton TanStack Query client
- `sanitize.ts` — Regex-based HTML sanitizer
- `server-fn.handler.ts` — `createHandler` bridge from Effect services to TanStack server functions

## File Structure Conventions

- `src/routes/` — TanStack Router file-based route structure (flat layout group `(auth)/`)
- `src/lib/<feature>/<feature>.service.ts` — Effect service with embedded TanStack server functions
- `src/lib/<feature>/<feature>.schema.ts` — Effect Schema for validation
- `src/lib/<feature>/<feature>.queries.ts` — TanStack Query `queryOptions` factories
- `src/lib/<feature>/<feature>.hooks.ts` — React hooks (mutations, query wrappers)
- `src/lib/<feature>/<feature>.utils.ts` — Pure utility functions

## Authentication

- Server config in `src/lib/auth/index.ts` (Better Auth with Drizzle adapter)
- Client config in `src/lib/auth/client.ts` (Better Auth React client)
- Auth middleware in `src/lib/auth/auth.middleware.ts` (client-safe `getUserSession` server fn) backed by session effects in `src/lib/auth/session.effect.ts` (`getSessionEffect`, `getUserSessionEffect`)
- Auth hooks in `src/lib/auth/auth.hooks.ts` (TanStack Query mutations)
- Auth schemas in `src/lib/auth/auth.schemas.ts` (Effect Schema)

## Database

- Drizzle ORM schemas in `src/lib/db/schema/` (auth tables plus sakuga domain tables: posts, tags, comments, post votes, playlists, playlist posts)
- Kysely typed client in `src/lib/db/kysely.ts`
- KyselyDB Effect context tag in `src/lib/db/context.ts`
- Layer factories in `src/lib/db/layer-factories.server.ts` (DB, auth, middleware layers)
- Connection pool in `src/lib/db/pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`)
- Test utilities in `src/lib/db/test-utils.ts` and `e2e-db.ts` (PGlite in-memory, migrated from root `drizzle/`)
- TanStack DB collections in `src/lib/db/collections.ts`

## Upload & Storage

- Client-side video analysis in `src/lib/upload/upload.processor.ts` (mediainfo.js + mediabunny)
- Upload hooks in `src/lib/upload/useVideoProcessing.ts`, `useUploadDraft.ts`, `useUploadForm.ts`
- Storage service in `src/lib/storage/storage.module.ts` (Effect service interface)
- S3/R2 implementation in `src/lib/storage/storage.s3.ts`
- RustFS (S3-compatible) implementation for local dev/tests in `src/lib/storage/storage.rustfs.ts`
- Storage tests in `src/lib/storage/storage.test.ts` (rustfs layer)
