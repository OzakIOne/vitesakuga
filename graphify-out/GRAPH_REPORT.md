# Graph Report - vitesakuga (2026-08-07)

## Corpus Check

- 170 files · ~64,048 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1074 nodes · 1700 edges · 131 communities (52 shown, 79 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `eed34213`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- posts.schema.ts
- test-utils.ts
- upload.lazy.tsx
- playlists.service.ts
- rules
- __root.tsx
- posts.service.ts
- sakuga.utils.ts
- TypeScript & React Conventions
- scripts
- compilerOptions
- auth.hooks.ts
- routeTree.gen.ts
- AGENT GUIDELINES FOR ViteSakuga
- `src/lib/`
- effect.utils.ts
- opencode.json
- -convert.machine.ts
- dependencies
- FileRoutesByPath
- Domain Glossary
- router.tsx
- global-setup.ts
- devDependencies
- ViteSakuga
- PGliteDriver
- knip.json
- index.tsx
- vitest.setup.ts
- Domain Docs
- Issue tracker: GitHub
- setup-cdp.mjs
- vite-env.d.ts
- tooltip.tsx
- $.ts
- route.tsx
- vite.config.ts
- @aws-sdk/client-s3
- better-auth
- @chakra-ui/react
- @cloudflare/vite-plugin
- @cloudflare/workers-types
- triage-labels.md
- dotenv
- drizzle-orm
- drizzle-seed
- @effect/eslint-plugin
- @effect/language-service
- @effect/tsgo
- @electric-sql/pglite
- @emotion/react
- isomorphic-dompurify
- jsdom
- kysely
- mediabunny
- mediainfo.js
- neonctl
- @neondatabase/serverless
- next-themes
- nitro
- @opentelemetry/api
- @opentelemetry/exporter-logs-otlp-http
- @opentelemetry/exporter-trace-otlp-http
- @opentelemetry/resources
- @opentelemetry/sdk-trace-node
- oxfmt
- oxlint
- pg
- postgres
- react
- react-dom
- react-icons
- @tailwindcss/vite
- @tanstack/db
- @tanstack/query-db-collection
- @tanstack/react-db
- @tanstack/react-form
- @tanstack/react-form-devtools
- @tanstack/react-hotkeys
- @tanstack/react-pacer
- @tanstack/react-pacer-devtools
- @tanstack/react-query
- @tanstack/react-query-devtools
- @tanstack/react-router
- @tanstack/react-router-devtools
- @tanstack/react-router-ssr-query
- @tanstack/react-start
- xstate
- @xstate/react
- @playwright/test
- @tanstack/devtools-vite
- @tanstack/eslint-plugin-query
- @tanstack/eslint-plugin-router
- @tanstack/react-devtools
- taze
- @testing-library/react
- @types/bun
- @types/node
- @types/pg
- @types/react
- @types/react-dom
- typescript
- vite
- @vitejs/plugin-react
- vitest
- wrangler
- Route
- upload.lazy.tsx
- index.tsx
- @effect/opentelemetry
- PostEditForm.tsx
- layer-factories.server.ts
- PGliteDriver
- probe.ts
- @effect/opentelemetry
- media-chrome
- @opentelemetry/sdk-logs
- @emotion/react
- @neondatabase/serverless
- @opentelemetry/exporter-logs-otlp-http
- @opentelemetry/sdk-trace-web
- @opentelemetry/semantic-conventions

## God Nodes (most connected - your core abstractions)

1. `scripts` - 29 edges
2. `compilerOptions` - 29 edges
3. `rules` - 22 edges
4. `FileRoutesByPath` - 17 edges
5. `parse()` - 14 edges
6. `src/lib/` - 14 edges
7. `plugins` - 12 edges
8. `AGENT GUIDELINES FOR ViteSakuga` - 11 edges
9. `Domain Glossary` - 11 edges
10. `KyselyDB` - 10 edges

## Surprising Connections (you probably didn't know these)

- `makeAuthLayer()` --indirect_call--> `AuthService` [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/auth/context.ts
- `makeTestLayer()` --indirect_call--> `AuthService` [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `makeAuthLayer()` --indirect_call--> `RequestHeadersService` [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/auth/context.ts
- `makeTestLayer()` --indirect_call--> `RequestHeadersService` [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()` [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx

## Import Cycles

- None detected.

## Communities (131 total, 79 thin omitted)

### Community 0 - "posts.schema.ts"

Cohesion: 0.23
Nodes (11): Pagination(), PaginationProps, PostsPageLayout(), DbSchemaSelect, PopularTag, PostListingData, usePostsPage(), postsQueryByTag() (+3 more)

### Community 1 - "test-utils.ts"

Cohesion: 0.28
Nodes (8): getSessionEffect, getUserSessionEffect, SessionFetchError, AuthService, AuthSessionProvider, RequestHeadersService, makeMiddlewareLayer(), resolveMiddlewareLayer()

### Community 2 - "upload.lazy.tsx"

Cohesion: 0.20
Nodes (7): CommentDraft, commentDraftsCollection, queryClient, UploadDraft, usersCollection, fetchUsers, Route

### Community 3 - "playlists.service.ts"

Cohesion: 0.06
Nodes (44): PlaylistAddModal(), PlaylistAddModalProps, defaultPlaylistsFns, PlaylistsFnsContext, testUser, testUser2, playlistsKeys, playlistsQueries (+36 more)

### Community 4 - "rules"

Cohesion: 0.04
Nodes (48): ignorePatterns, jsPlugins, options, typeAware, typeCheck, plugins, rules, @effect/dprint (+40 more)

### Community 5 - "__root.tsx"

Cohesion: 0.10
Nodes (19): GlobalShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, SHORTCUTS, ColorMode, ColorModeButton, ColorModeButtonProps (+11 more)

### Community 6 - "posts.service.ts"

Cohesion: 0.07
Nodes (38): userSelectSchema, postsSelectSchema, postRow, parse(), parseStrict(), CommentNotFoundError, ForbiddenError, PlaylistNotFoundError (+30 more)

### Community 7 - "sakuga.utils.ts"

Cohesion: 0.06
Nodes (31): account, session, user, userInsertSchema, verification, commentInsertSchema, comments, playlistPosts (+23 more)

### Community 8 - "TypeScript & React Conventions"

Cohesion: 0.05
Nodes (34): Additional Resources, Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections (+26 more)

### Community 9 - "scripts"

Cohesion: 0.05
Nodes (39): devEngines, runtime, engines, node, name, private, name, onFail (+31 more)

### Community 10 - "compilerOptions"

Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/_.ts, \**/_.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"

Cohesion: 0.11
Nodes (27): PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, VisibilityTrigger, createWrapper(), useChangePassword() (+19 more)

### Community 12 - "routeTree.gen.ts"

Cohesion: 0.07
Nodes (35): Route, Route, Route, Route, Route, Route, Route, Route (+27 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"

Cohesion: 0.08
Nodes (26): AGENT GUIDELINES FOR ViteSakuga, Agent skills, Async & Promises, Build, Lint, and Test Commands, Code Organization, Core Principles, Database Commands (Drizzle Kit), Detailed Guidelines (+18 more)

### Community 14 - "`src/lib/`"

Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 15 - "effect.utils.ts"

Cohesion: 0.18
Nodes (19): EffectExecutor, EffectKysely, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan() (+11 more)

### Community 16 - "opencode.json"

Cohesion: 0.11
Nodes (18): path, description, repository, description, repository, lsp, mcp, signoz (+10 more)

### Community 17 - "-convert.machine.ts"

Cohesion: 0.18
Nodes (12): ActorLike, outputFormats, Route, RouteComponent(), ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertProgressEvent (+4 more)

### Community 18 - "dependencies"

Cohesion: 0.15
Nodes (13): alchemy, better-auth, drizzle-kit, @effect/opentelemetry, mediabunny, @opentelemetry/sdk-trace-base, dependencies, alchemy (+5 more)

### Community 19 - "FileRoutesByPath"

Cohesion: 0.25
Nodes (7): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes

### Community 20 - "Domain Glossary"

Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 21 - "router.tsx"

Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 22 - "global-setup.ts"

Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 23 - "devDependencies"

Cohesion: 0.22
Nodes (9): oxlint-tsgolint, devDependencies, knip, oxlint-tsgolint, tailwindcss, @testing-library/jest-dom, knip, tailwindcss (+1 more)

### Community 24 - "ViteSakuga"

Cohesion: 0.22
Nodes (8): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Infrastructure Setup, Patches, Secondary, ViteSakuga

### Community 26 - "knip.json"

Cohesion: 0.25
Nodes (7): entry, ignore, project, $schema, **/\*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 27 - "index.tsx"

Cohesion: 0.20
Nodes (14): KyselyDB, DB, LOG_LAYER, makeAuthLayer(), makeDBLayer(), createTestKysely(), LOG_LAYER, makeServiceTestLayer() (+6 more)

### Community 28 - "vitest.setup.ts"

Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureRustFS, exec(), isRunning, waitForHealth

### Community 29 - "Domain Docs"

Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 30 - "Issue tracker: GitHub"

Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 32 - "vite-env.d.ts"

Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 34 - "$.ts"

Cohesion: 0.09
Nodes (34): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), PostEditForm(), PostEditFormProps, toaster, uploadDraftCollection, safeParseStrict() (+26 more)

### Community 35 - "route.tsx"

Cohesion: 0.13
Nodes (15): postsQueries, CoerceNumber, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, PostByTagParams, postByTagSchema (+7 more)

### Community 37 - "@aws-sdk/client-s3"

Cohesion: 0.38
Nodes (4): UserErrorComponent(), userQueryOptions(), Route, UserContent()

### Community 44 - "drizzle-orm"

Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 51 - "@emotion/react"

Cohesion: 0.22
Nodes (9): tagsKeys, tagsQueries, getAllPopularTags, getAllPopularTagsEffect, getAllTags, getAllTagsEffect, TagsService, TagsServiceLive (+1 more)

### Community 53 - "jsdom"

Cohesion: 0.13
Nodes (19): CommentsContent(), CommentsProps, CommentsFnsContext, defaultCommentsFns, testUser, useAddComment(), useDeleteComment(), commentsKeys (+11 more)

### Community 55 - "mediabunny"

Cohesion: 0.31
Nodes (6): Comments(), Post(), PostDetailDisplay(), PostDetailDisplayProps, User(), fetchPostDetail

### Community 110 - "Route"

Cohesion: 0.22
Nodes (10): SearchBox(), SearchBoxProps, TagInput(), TagInputProps, tagsCollection, Tag, useTagCollection(), tagsQueryGetPopularTags() (+2 more)

### Community 120 - "upload.lazy.tsx"

Cohesion: 0.18
Nodes (13): NotFound(), PostCard, PostCardComponent(), PostListProps, Video, VideoProps, assetUrl(), playlistQueryDetail() (+5 more)

### Community 122 - "index.tsx"

Cohesion: 0.15
Nodes (13): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, SessionTable (+5 more)

### Community 124 - "PostEditForm.tsx"

Cohesion: 0.38
Nodes (5): PostErrorComponent(), postQueryDetail(), searchPostsBaseSchema, PostComponent(), Route

### Community 127 - "probe.ts"

Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

## Knowledge Gaps

- **488 isolated node(s):** `$schema`, `eslint`, `typescript`, `unicorn`, `oxc` (+483 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **79 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `@effect/opentelemetry`, `media-chrome`, `@opentelemetry/sdk-logs`, `@emotion/react`, `@neondatabase/serverless`, `@opentelemetry/exporter-logs-otlp-http`, `@opentelemetry/sdk-trace-web`, `@opentelemetry/semantic-conventions`, `scripts`, `better-auth`, `@chakra-ui/react`, `isomorphic-dompurify`, `kysely`, `mediainfo.js`, `neonctl`, `next-themes`, `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-node`, `pg`, `postgres`, `react`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/db`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `layer-factories.server.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `dotenv`, `drizzle-seed`, `@effect/eslint-plugin`, `@effect/language-service`, `@effect/tsgo`, `@electric-sql/pglite`, `nitro`, `oxfmt`, `oxlint`, `@playwright/test`, `@tanstack/devtools-vite`, `@tanstack/eslint-plugin-query`, `@tanstack/eslint-plugin-router`, `@tanstack/react-devtools`, `taze`, `@testing-library/react`, `@types/bun`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `wrangler`, `@effect/opentelemetry`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `PGliteDriver` connect `PGliteDriver` to `PGliteDriver`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `eslint`, `typescript` to the rest of the system?**
  _488 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `playlists.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.056261343012704176 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `__root.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10052910052910052 - nodes in this community are weakly interconnected._
