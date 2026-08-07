# Graph Report - vitesakuga  (2026-08-06)

## Corpus Check
- 168 files · ~63,726 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1067 nodes · 1682 edges · 131 communities (53 shown, 78 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a256edd9`
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
- drizzle-zod
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
- @opentelemetry/sdk-trace-base
- @opentelemetry/sdk-trace-node
- @opentelemetry/semantic-conventions
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
- zod
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
- useUploadForm.ts
- index.tsx
- @effect/opentelemetry
- PostEditForm.tsx
- layer-factories.server.ts
- PGliteDriver
- probe.ts
- @effect/opentelemetry
- media-chrome
- @opentelemetry/sdk-logs

## God Nodes (most connected - your core abstractions)
1. `scripts` - 29 edges
2. `compilerOptions` - 29 edges
3. `rules` - 22 edges
4. `FileRoutesByPath` - 17 edges
5. ``src/lib/`` - 14 edges
6. `plugins` - 12 edges
7. `parse()` - 12 edges
8. `AGENT GUIDELINES FOR ViteSakuga` - 11 edges
9. `Domain Glossary` - 11 edges
10. `KyselyDB` - 10 edges

## Surprising Connections (you probably didn't know these)
- `makeTestLayer()` --indirect_call--> `AuthService`  [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `makeTestLayer()` --indirect_call--> `RequestHeadersService`  [INFERRED]
  src/lib/db/test-utils.ts → src/lib/auth/context.ts
- `makeDBLayer()` --indirect_call--> `KyselyDB`  [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/db/context.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `PostCardComponent()` --calls--> `assetUrl()`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/assets/url.ts

## Import Cycles
- None detected.

## Communities (131 total, 78 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.06
Nodes (48): Comments(), NotFound(), Pagination(), PaginationProps, PopularTag, PopularTagsSection(), PopularTagsSectionProps, Post() (+40 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.21
Nodes (13): getSessionEffect, getUserSessionEffect, SessionFetchError, AuthService, AuthSessionProvider, RequestHeadersService, LOG_LAYER, makeAuthLayer() (+5 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.19
Nodes (8): CommentDraft, queryClient, tagsCollection, UploadDraft, uploadDraftCollection, usersCollection, fetchUsers, Route

### Community 3 - "playlists.service.ts"
Cohesion: 0.05
Nodes (49): PlaylistAddModal(), PlaylistAddModalProps, CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError (+41 more)

### Community 4 - "rules"
Cohesion: 0.04
Nodes (48): ignorePatterns, jsPlugins, options, typeAware, typeCheck, plugins, rules, @effect/dprint (+40 more)

### Community 5 - "__root.tsx"
Cohesion: 0.10
Nodes (19): GlobalShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, SHORTCUTS, ColorMode, ColorModeButton, ColorModeButtonProps (+11 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.11
Nodes (17): computePagination(), PaginationInput, PaginationMeta, defaultVideoMetadata, testUser, FormFileUploadSchema, postByTagSchema, fetchPostDetailEffect (+9 more)

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.11
Nodes (18): CommentsInsert, commentsInsertSchema, CommentsSelect, commentsSelectSchema, DbSchemaInsert, playlistPostsInsertSchema, playlistPostsSelectSchema, playlistsInsertSchema (+10 more)

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
Nodes (13): alchemy, drizzle-orm, @emotion/react, @neondatabase/serverless, @opentelemetry/exporter-logs-otlp-http, @opentelemetry/semantic-conventions, dependencies, alchemy (+5 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.19
Nodes (11): postsSelectSchema, mapPopularTags(), usersKeys, usersQueries, FetchUserInput, fetchUserInputSchema, fetchUserPosts, fetchUserPostsEffect (+3 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 21 - "router.tsx"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startGarage, waitForHealth

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
Cohesion: 0.27
Nodes (9): KyselyDB, DB, createTestKysely(), LOG_LAYER, makeServiceTestLayer(), makeTestLayer(), ServiceTestContext, makeFromKysely() (+1 more)

### Community 28 - "vitest.setup.ts"
Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureGarage, exec(), isRunning, waitForHealth

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
Cohesion: 0.36
Nodes (9): VideoMetadata, analyzeVideo(), generateAutoThumbnails(), GeneratedThumbnail, generateThumbnails(), makeReadChunk(), useVideoProcessing(), VideoProcessingActions (+1 more)

### Community 35 - "route.tsx"
Cohesion: 0.12
Nodes (16): sanitizeString(), CoerceNumber, FileUploadData, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, RelatedPostId (+8 more)

### Community 37 - "@aws-sdk/client-s3"
Cohesion: 0.22
Nodes (7): commentInsertSchema, comments, playlistPosts, playlists, posts, postTags, tags

### Community 44 - "drizzle-orm"
Cohesion: 0.50
Nodes (5): makeGarageStorageLayer(), StorageError, StorageModule, StorageLive, runTest()

### Community 46 - "drizzle-zod"
Cohesion: 0.29
Nodes (6): account, session, user, userInsertSchema, userSelectSchema, verification

### Community 51 - "@emotion/react"
Cohesion: 0.43
Nodes (5): getAllPopularTagsEffect, getAllTags, getAllTagsEffect, TagsService, TagsServiceLive

### Community 53 - "jsdom"
Cohesion: 0.13
Nodes (20): CommentsContent(), CommentsProps, CommentsFnsContext, defaultCommentsFns, testUser, useAddComment(), useDeleteComment(), commentsKeys (+12 more)

### Community 110 - "Route"
Cohesion: 0.32
Nodes (6): tagsKeys, tagsQueries, tagsQueryGetPopularTags(), getAllPopularTags, Home(), Route

### Community 120 - "upload.lazy.tsx"
Cohesion: 0.38
Nodes (5): SearchBox(), SearchBoxProps, TagInput(), TagInputProps, useTagCollection()

### Community 121 - "useUploadForm.ts"
Cohesion: 0.31
Nodes (8): safeParseStrict(), Tag, uploadPost, buildFormData(), UploadDraftData, UseUploadDraftReturn, useUploadForm(), UseUploadFormParams

### Community 122 - "index.tsx"
Cohesion: 0.15
Nodes (13): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, SessionTable (+5 more)

### Community 124 - "PostEditForm.tsx"
Cohesion: 0.15
Nodes (17): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), PostEditForm(), PostEditFormProps, toaster, postQueryDetail(), postsKeys (+9 more)

### Community 127 - "probe.ts"
Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

## Knowledge Gaps
- **486 isolated node(s):** `$schema`, `eslint`, `typescript`, `unicorn`, `oxc` (+481 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **78 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `@effect/opentelemetry`, `media-chrome`, `@opentelemetry/sdk-logs`, `scripts`, `better-auth`, `@chakra-ui/react`, `isomorphic-dompurify`, `kysely`, `mediabunny`, `mediainfo.js`, `neonctl`, `next-themes`, `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/semantic-conventions`, `pg`, `postgres`, `react`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/db`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `zod`, `layer-factories.server.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `dotenv`, `drizzle-seed`, `@effect/eslint-plugin`, `@effect/language-service`, `@effect/tsgo`, `@electric-sql/pglite`, `nitro`, `oxfmt`, `oxlint`, `@playwright/test`, `@tanstack/devtools-vite`, `@tanstack/eslint-plugin-query`, `@tanstack/eslint-plugin-router`, `@tanstack/react-devtools`, `taze`, `@testing-library/react`, `@types/bun`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `wrangler`, `@effect/opentelemetry`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `KyselyDB` connect `index.tsx` to `test-utils.ts`, `playlists.service.ts`, `posts.service.ts`, `@emotion/react`, `FileRoutesByPath`, `jsdom`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `eslint`, `typescript` to the rest of the system?**
  _486 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `posts.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05594679186228482 - nodes in this community are weakly interconnected._
- **Should `playlists.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05222734254992319 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._