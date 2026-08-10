# Graph Report - vitesakuga  (2026-08-10)

## Corpus Check
- 173 files · ~64,537 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1066 nodes · 1699 edges · 128 communities (51 shown, 77 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b668b673`
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
- knip.json
- index.tsx
- vitest.setup.ts
- Domain Docs
- Issue tracker: GitHub
- setup-cdp.mjs
- vite-env.d.ts
- tooltip.tsx
- route.tsx
- vite.config.ts
- better-auth
- @chakra-ui/react
- @cloudflare/vite-plugin
- @cloudflare/workers-types
- triage-labels.md
- dotenv
- drizzle-orm
- drizzle-seed
- users.service.ts
- @effect/eslint-plugin
- @effect/language-service
- @effect/tsgo
- @electric-sql/pglite
- @emotion/react
- isomorphic-dompurify
- kysely
- mediainfo.js
- neonctl
- @neondatabase/serverless
- next-themes
- nitro
- @opentelemetry/api
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
- playlists.schema.ts
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
- comments.service.ts
- index.tsx
- @effect/opentelemetry
- layer-factories.server.ts
- probe.ts
- @effect/opentelemetry
- media-chrome
- @opentelemetry/sdk-logs
- @emotion/react
- @neondatabase/serverless
- @opentelemetry/exporter-logs-otlp-http
- @opentelemetry/sdk-trace-web
- @opentelemetry/semantic-conventions
- better-auth

## God Nodes (most connected - your core abstractions)
1. `scripts` - 29 edges
2. `compilerOptions` - 29 edges
3. `rules` - 22 edges
4. `FileRoutesByPath` - 17 edges
5. `parse()` - 14 edges
6. ``src/lib/`` - 14 edges
7. `plugins` - 12 edges
8. `DB` - 11 edges
9. `AGENT GUIDELINES FOR ViteSakuga` - 11 edges
10. `Domain Glossary` - 11 edges

## Surprising Connections (you probably didn't know these)
- `PostCardComponent()` --calls--> `assetUrl()`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/assets/url.ts
- `makeTestLayer()` --indirect_call--> `AuthService`  [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `makeTestLayer()` --indirect_call--> `RequestHeadersService`  [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `makeAuthLayer()` --indirect_call--> `AuthService`  [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/auth/context.ts

## Import Cycles
- None detected.

## Communities (128 total, 77 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.12
Nodes (21): Pagination(), PaginationProps, PostCard, PostCardComponent(), PostListProps, PostsPageLayout(), UserErrorComponent(), DbSchemaSelect (+13 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.19
Nodes (14): getSessionEffect, getUserSessionEffect, SessionFetchError, AuthService, RequestHeadersService, LOG_LAYER, makeAuthLayer(), makeMiddlewareLayer() (+6 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.12
Nodes (14): SearchBox(), SearchBoxProps, TagInput(), TagInputProps, User(), CommentDraft, queryClient, tagsCollection (+6 more)

### Community 3 - "playlists.service.ts"
Cohesion: 0.15
Nodes (16): computePagination(), PaginationInput, PaginationMeta, removePostFromPlaylistInputSchema, addPostToPlaylist, createPlaylist, deletePlaylist, PlaylistDetailResult (+8 more)

### Community 4 - "rules"
Cohesion: 0.04
Nodes (48): ignorePatterns, jsPlugins, options, typeAware, typeCheck, plugins, rules, @effect/dprint (+40 more)

### Community 5 - "__root.tsx"
Cohesion: 0.06
Nodes (33): CommentsContent(), CommentsProps, GlobalShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, SHORTCUTS, ColorMode (+25 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.06
Nodes (34): account, session, user, userInsertSchema, userSelectSchema, verification, commentInsertSchema, comments (+26 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.05
Nodes (34): Additional Resources, Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections (+26 more)

### Community 9 - "scripts"
Cohesion: 0.05
Nodes (39): devEngines, runtime, engines, node, name, private, name, onFail (+31 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.10
Nodes (28): FieldInfo(), PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, VisibilityTrigger, createWrapper() (+20 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (36): Route, AuthSearchSchema, Route, Route, Route, Route, Route, Route (+28 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.08
Nodes (26): AGENT GUIDELINES FOR ViteSakuga, Agent skills, Async & Promises, Build, Lint, and Test Commands, Code Organization, Core Principles, Database Commands (Drizzle Kit), Detailed Guidelines (+18 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.06
Nodes (24): PGliteConnection, PGliteDialect, PGliteDriver, EFFECT_KYSELY_MARKER, EffectExecutor, EffectKysely, EffectTransition, Executable (+16 more)

### Community 16 - "opencode.json"
Cohesion: 0.11
Nodes (18): path, description, repository, description, repository, lsp, mcp, signoz (+10 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.18
Nodes (12): ActorLike, outputFormats, Route, RouteComponent(), ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertProgressEvent (+4 more)

### Community 18 - "dependencies"
Cohesion: 0.15
Nodes (13): alchemy, drizzle-kit, @effect/opentelemetry, @emotion/react, mediabunny, @opentelemetry/sdk-trace-base, dependencies, alchemy (+5 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.14
Nodes (10): PlaylistAddModal(), PlaylistAddModalProps, PlaylistsFnsContext, playlistsKeys, playlistsQueries, playlistsQueryForPost(), fetchPlaylistDetailSchema, fetchPlaylistDetail (+2 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 21 - "router.tsx"
Cohesion: 0.33
Nodes (4): testUser, testUser2, PlaylistsService, PlaylistsServiceLive

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
Nodes (7): entry, ignore, project, $schema, **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 27 - "index.tsx"
Cohesion: 0.31
Nodes (9): AuthSessionProvider, KyselyDB, makeDBLayer(), createTestKysely(), LOG_LAYER, makeServiceTestLayer(), makeTestLayer(), ServiceTestContext (+1 more)

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

### Community 35 - "route.tsx"
Cohesion: 0.06
Nodes (62): Comments(), FormTextareaFieldProps, FormTextWrapper(), Post(), PostDetailDisplay(), PostDetailDisplayProps, PostEditForm(), PostEditFormProps (+54 more)

### Community 44 - "drizzle-orm"
Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 46 - "users.service.ts"
Cohesion: 0.23
Nodes (9): UserNotFoundError, ValidationError, usersKeys, usersQueries, FetchUserInput, fetchUserInputSchema, fetchUserPosts, UsersService (+1 more)

### Community 51 - "@emotion/react"
Cohesion: 0.43
Nodes (4): getAllTags, TagsService, TagsServiceLive, mapPopularTags()

### Community 92 - "playlists.schema.ts"
Cohesion: 0.28
Nodes (7): addPostToPlaylistInputSchema, createPlaylistInputSchema, reorderPlaylistPostsInputSchema, sanitizeString(), updatePlaylistInputSchema, sanitizeString(), sanitize()

### Community 110 - "Route"
Cohesion: 0.15
Nodes (13): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, tagsKeys (+5 more)

### Community 120 - "upload.lazy.tsx"
Cohesion: 0.23
Nodes (10): NotFound(), Video, VideoProps, assetUrl(), playlistQueryDetail(), playlistsQueryUserPlaylists(), PlaylistsContent(), PlaylistDetailContent() (+2 more)

### Community 121 - "comments.service.ts"
Cohesion: 0.20
Nodes (11): AuthServices, testUser, CommentsService, CommentsServiceLive, CommentWithUser, CommentNotFoundError, ForbiddenError, PlaylistNotFoundError (+3 more)

### Community 122 - "index.tsx"
Cohesion: 0.09
Nodes (18): AccountTable, CommentsTable, DB, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable (+10 more)

### Community 127 - "probe.ts"
Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

## Knowledge Gaps
- **486 isolated node(s):** `{ chromium }`, `logs`, `$schema`, `eslint`, `typescript` (+481 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `@effect/opentelemetry`, `media-chrome`, `@opentelemetry/sdk-logs`, `@neondatabase/serverless`, `@opentelemetry/exporter-logs-otlp-http`, `@opentelemetry/sdk-trace-web`, `@opentelemetry/semantic-conventions`, `scripts`, `better-auth`, `better-auth`, `@chakra-ui/react`, `isomorphic-dompurify`, `kysely`, `mediainfo.js`, `neonctl`, `next-themes`, `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-node`, `pg`, `postgres`, `react`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/db`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `layer-factories.server.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `dotenv`, `drizzle-seed`, `@effect/eslint-plugin`, `@effect/language-service`, `@effect/tsgo`, `@electric-sql/pglite`, `nitro`, `oxfmt`, `oxlint`, `@playwright/test`, `@tanstack/devtools-vite`, `@tanstack/eslint-plugin-query`, `@tanstack/eslint-plugin-router`, `@tanstack/react-devtools`, `taze`, `@testing-library/react`, `@types/bun`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `wrangler`, `@effect/opentelemetry`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `parse()` connect `route.tsx` to `playlists.service.ts`, `sakuga.utils.ts`, `auth.hooks.ts`, `users.service.ts`, `upload.lazy.tsx`, `comments.service.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `{ chromium }`, `logs`, `$schema` to the rest of the system?**
  _486 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `posts.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12183908045977011 - nodes in this community are weakly interconnected._
- **Should `upload.lazy.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1225296442687747 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._