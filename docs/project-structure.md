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
│   ├── comments/      # Comments, mentions, queries, hooks, and tests
│   ├── db/            # Kysely, Drizzle schemas, layers, pools, test utilities
│   │   └── schema/    # Drizzle ORM table definitions (auth + sakuga)
│   ├── effect/        # Effect wrappers, logging, tracing, schema utilities
│   ├── env/           # Environment validation (client, server, infra)
│   ├── mentions/      # Comment mention parsing and resolution
│   ├── moderation/   # Staff queues and role assignment
│   ├── mutations/    # Shared mutation feedback (toasts, error messages)
│   ├── notifications/ # In-app notifications
│   ├── pagination/   # Pagination computation utility
│   ├── playlists/    # Playlists: service, hooks, queries, schemas, tests
│   ├── points/       # Points ledger and promotion thresholds
│   ├── post-edits/   # Wiki-style edit suggestions and approvals
│   ├── posts/        # Posts, search, uploads, queries, hooks, and tests
│   ├── promotions/   # Uploader promotion queue and decisions
│   ├── reports/      # User post reports
│   ├── rate-limit/   # Request rate limiting middleware and service
│   ├── search/       # Shared search limits
│   ├── storage/      # S3-compatible R2/RustFS adapter and policies
│   ├── tags/         # Tags: service, queries, utilities, tests
│   ├── upload/       # Client-side upload processing and draft hooks
│   ├── users/        # Users: service, queries, schemas, tests
│   ├── videos/       # Video replacement and storage garbage collection
│   └── votes/        # Post votes: service, hooks, queries, schemas, tests
├── routes/       # TanStack Router file-based routes
├── styles/       # Global CSS (Tailwind v4 entry point)
└── utils/        # Utility functions (SEO meta tags)
```

> Drizzle Kit migrations are generated in the repo-root `drizzle/` directory (timestamped folders, per `drizzle.config.ts`). The old `src/db/` area is not part of the active migration workflow.

**Key files at `src/lib/` root:**

- `errors.ts` — Effect `Schema.TaggedError` domain error classes
- `mutations/mutation-feedback.ts` — Shared mutation feedback (`useMutationWithFeedback`, `toastError`/`toastSuccess`, `errorMessage`)
- `query-client.ts` — Singleton TanStack Query client
- `sanitize.ts` / `sanitize.server.ts` — shared sanitizer plus server registration
- `server-fn.handler.ts` — `createHandler` bridge from Effect services to TanStack server functions

## File Structure Conventions

- `src/routes/` — TanStack Router file-based route structure (flat layout group `(auth)/`)
- `src/lib/<feature>/<feature>.service.ts` — Effect service with embedded TanStack server functions
- `src/lib/<feature>/<feature>.schema.ts` — Effect Schema for validation
- `src/lib/<feature>/<feature>.queries.ts` — TanStack Query `queryOptions` factories
- `src/lib/<feature>/<feature>.hooks.ts` — React hooks (mutations, query wrappers)
- `src/lib/<feature>/<feature>.utils.ts` — Pure utility functions
- `src/lib/<feature>/*.test.{ts,tsx}` — Unit/integration tests for the feature service, schema, or hooks

## Authentication

- Server config in `src/lib/auth/index.ts` (Better Auth with Drizzle adapter)
- Client config in `src/lib/auth/client.ts` (Better Auth React client)
- Auth middleware in `src/lib/auth/auth.middleware.ts` (client-safe `getUserSession` server fn) backed by `SessionService` in `src/lib/auth/session.effect.ts` (`getSession`, `getUser`, `requireUser`)
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
- S3-compatible implementation for R2 and RustFS in `src/lib/storage/storage.adapter.ts`
- Storage interface and tagged errors in `src/lib/storage/storage.module.ts`
- Upload policy, key, and content-type helpers in `src/lib/storage/`
- Storage tests in `src/lib/storage/storage.test.ts` (RustFS layer)
