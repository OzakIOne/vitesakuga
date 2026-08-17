# Graph Report - vitesakuga  (2026-08-17)

## Corpus Check
- 200 files · ~88,037 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1280 nodes · 2464 edges · 152 communities (69 shown, 83 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `27f67791`
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
- DB
- knip.json
- index.tsx
- vitest.setup.ts
- Domain Docs
- Issue tracker: GitHub
- setup-cdp.mjs
- vite-env.d.ts
- tooltip.tsx
- schema.utils.ts
- route.tsx
- vite.config.ts
- PGliteDriver
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
- users.index.tsx
- kysely
- @emotion/react
- mediainfo.js
- neonctl
- @neondatabase/serverless
- next-themes
- nitro
- @opentelemetry/api
- users.service.ts
- @opentelemetry/exporter-trace-otlp-http
- @opentelemetry/resources
- useUploadForm.ts
- @opentelemetry/sdk-trace-node
- PGliteDriver
- oxfmt
- playlists.schema.ts
- pg
- postgres
- useResponsiveColumns.ts
- react-dom
- react-icons
- @tailwindcss/vite
- @tanstack/db
- check-password-strength
- @tanstack/react-db
- @tanstack/react-form
- @tanstack/react-form-devtools
- @effect/opentelemetry
- @opentelemetry/exporter-trace-otlp-http
- @tanstack/query-db-collection
- @tanstack/react-query
- @tanstack/react-query-devtools
- @tanstack/react-router
- @tanstack/react-router-devtools
- @tanstack/react-router-ssr-query
- @tanstack/react-start
- xstate
- @xstate/react
- kysely
- @playwright/test
- @tanstack/react-pacer
- @tanstack/eslint-plugin-query
- @tanstack/eslint-plugin-router
- @tanstack/react-pacer-devtools
- Route
- @testing-library/react
- @types/bun
- @types/node
- @types/pg
- Route
- @types/react-dom
- @effect/eslint-plugin
- Route
- @vitejs/plugin-react
- vitest
- wrangler
- upload.lazy.tsx
- drizzle.config.ts
- comments.service.ts
- index.tsx
- @effect/opentelemetry
- errors.ts
- layer-factories.server.ts
- useUploadForm.ts
- PGliteConnection
- @opentelemetry/sdk-logs
- kysely
- @neondatabase/serverless
- @opentelemetry/sdk-trace-base
- Route
- @opentelemetry/sdk-trace-web
- safelist.ts
- feedback.tsx
- comments.service.ts
- storage.module.ts
- KeyboardShortcutsDialog.tsx
- index.ts
- react
- @cloudflare/workers-types
- tailwindcss
- better-auth
- vite
- effect
- @opentelemetry/sdk-trace-base
- oxlint
- knip
- @types/react
- typescript
- media-chrome

## God Nodes (most connected - your core abstractions)
1. `useChakraProps()` - 38 edges
2. `cx()` - 37 edges
3. `scripts` - 32 edges
4. `compilerOptions` - 29 edges
5. `Box()` - 25 edges
6. `useMutationWithFeedback()` - 25 edges
7. `rules` - 22 edges
8. `Button()` - 21 edges
9. `Text()` - 20 edges
10. `FileRoutesByPath` - 17 edges

## Surprising Connections (you probably didn't know these)
- `InputGroup()` --references--> `react`  [EXTRACTED]
  src/components/ui/field.tsx → package.json
- `Spinner()` --calls--> `cx()`  [EXTRACTED]
  src/components/ui/button.tsx → src/components/ui/ui-utils.ts
- `CommentComposer()` --calls--> `useAddComment()`  [EXTRACTED]
  src/components/Comments.tsx → src/lib/comments/comments.hooks.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `PlaylistAddModal()` --calls--> `playlistsQueryForPost()`  [EXTRACTED]
  src/components/PlaylistAddModal.tsx → src/lib/playlists/playlists.queries.ts

## Import Cycles
- None detected.

## Communities (152 total, 83 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.26
Nodes (8): NotFound(), PostErrorComponent(), PostsPageLayout(), Box(), UserErrorComponent(), VirtualPostsGrid(), toStandardSchemaV1Strict(), searchPostsBaseSchema

### Community 1 - "test-utils.ts"
Cohesion: 0.14
Nodes (21): getUserSession, AuthService, AuthSessionProvider, RequestHeadersService, getSessionEffect, getUserSessionEffect, SessionFetchError, SessionUser (+13 more)

### Community 3 - "playlists.service.ts"
Cohesion: 0.15
Nodes (13): alchemy, clsx, neonctl, @opentelemetry/exporter-logs-otlp-http, @opentelemetry/sdk-trace-node, dependencies, alchemy, clsx (+5 more)

### Community 4 - "rules"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 5 - "__root.tsx"
Cohesion: 0.09
Nodes (29): PlaylistAddModal(), PostVoteButtons, PostVoteButtonsComponent(), PostVoteButtonsProps, toaster, PostVote, errorMessage(), MutationFeedbackOptions (+21 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.05
Nodes (39): account, session, user, userInsertSchema, userSelectSchema, verification, commentInsertSchema, comments (+31 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.19
Nodes (12): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, SearchBox() (+4 more)

### Community 9 - "scripts"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.06
Nodes (46): Checkbox, INPUT_SIZES, InputGroupProps, InputProps, TextareaProps, getPasswordStrength(), PasswordInput, PasswordInputProps (+38 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (25): AccountRoute, ApiAuthSplatRoute, authLoginRoute, authRouteRoute, authRouteRouteChildren, authRouteRouteWithChildren, authSignupRoute, ConvertRoute (+17 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.16
Nodes (15): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), InputProps, TextareaProps, Field, Input(), Avatar (+7 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.10
Nodes (20): rules, @effect/dprint, @effect/no-import-from-barrel-package, jsx-a11y/media-has-caption, jsx-a11y/no-autofocus, max-statements, no-void, react-perf/jsx-no-new-function-as-prop (+12 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.20
Nodes (18): EFFECT_KYSELY_MARKER, EffectExecutor, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan() (+10 more)

### Community 16 - "opencode.json"
Cohesion: 0.06
Nodes (36): command, type, headers, type, url, path, description, repository (+28 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.12
Nodes (18): RouteComponent(), clampVideoQuality(), ConvertContext, ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertMachineLogic, ConvertProgressEvent (+10 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (20): AccountTable, CommentsTable, DB, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable (+12 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.10
Nodes (25): Comments(), CommentsProps, PlaylistAddModalProps, Post(), PostDetailDisplay(), PostDetailDisplayProps, PostEditForm(), PostEditFormProps (+17 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.36
Nodes (9): VideoMetadata, analyzeVideo(), generateAutoThumbnails(), GeneratedThumbnail, generateThumbnails(), makeReadChunk(), useVideoProcessing(), VideoProcessingActions (+1 more)

### Community 21 - "router.tsx"
Cohesion: 0.17
Nodes (11): extends, jsPlugins, options, typeAware, typeCheck, $schema, @effect/eslint-plugin, ./node_modules/@effect/tsgo/oxlint-presets/correctness.json (+3 more)

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 24 - "ViteSakuga"
Cohesion: 0.17
Nodes (13): Pagination(), PaginationProps, HStack(), Stack(), Heading(), HEADING_SIZES, LinkProps, Text() (+5 more)

### Community 25 - "DB"
Cohesion: 0.17
Nodes (12): plugins, eslint, import, jsx-a11y, node, oxc, promise, react (+4 more)

### Community 26 - "knip.json"
Cohesion: 0.25
Nodes (7): entry, ignore, project, $schema, **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 28 - "vitest.setup.ts"
Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureRustFS, exec(), isRunning, waitForHealth

### Community 29 - "Domain Docs"
Cohesion: 0.27
Nodes (8): testUser, RemovePostVoteInput, removePostVoteSchema, SetPostVoteInput, setPostVoteSchema, PostVotesService, PostVotesServiceLive, PostVotesSummary

### Community 30 - "Issue tracker: GitHub"
Cohesion: 0.22
Nodes (9): SqlError, createHandler(), LayerShape, resolveMiddlewareLayer(), tagsKeys, tagsQueries, getAllPopularTags, TagsService (+1 more)

### Community 32 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 34 - "schema.utils.ts"
Cohesion: 0.19
Nodes (23): IconButton(), Skeleton(), Spinner(), InputGroup(), Textarea(), BoxProps, Center(), Container() (+15 more)

### Community 35 - "route.tsx"
Cohesion: 0.18
Nodes (11): PostCard, PostCardComponent(), PostListProps, VirtualPostsGridProps, assetUrl(), playlistsQueryUserPlaylists(), PostsSearchParams, BreakpointColumn (+3 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.17
Nodes (12): CommentDraft, commentDraftsCollection, queryClient, tagsCollection, UploadDraft, uploadDraftCollection, usersCollection, Tag (+4 more)

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): func-style, typescript/consistent-type-definitions, declaration, error, type

### Community 39 - "@chakra-ui/react"
Cohesion: 0.07
Nodes (34): defaultPlaylistsFns, PlaylistsFnsContext, testUser, testUser2, PLAYLIST_QUERY_CACHE, playlistsKeys, playlistsQueries, playlistsQueryForPost() (+26 more)

### Community 42 - "triage-labels.md"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Build, Lint, and Test Commands, Database Commands (Drizzle Kit), Detailed Guidelines, General Code Style Principles, General Commands, graphify, Package Manager (+4 more)

### Community 45 - "drizzle-seed"
Cohesion: 0.14
Nodes (12): SqlNoFirstResult, parse(), parseStrict(), defaultVideoMetadata, testUser, updatePostInputSchema, parsePostId(), PostDetailResult (+4 more)

### Community 46 - "users.service.ts"
Cohesion: 0.17
Nodes (11): Route, Route, Route, Route, Route, Route, Route, Route (+3 more)

### Community 50 - "@electric-sql/pglite"
Cohesion: 0.43
Nodes (6): safeParseStrict(), FormFileUploadSchema, uploadPost, buildFormData(), useUploadForm(), UseUploadFormParams

### Community 52 - "isomorphic-dompurify"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 54 - "kysely"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 58 - "@neondatabase/serverless"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 59 - "next-themes"
Cohesion: 0.13
Nodes (14): CoerceNumber, FileUploadData, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, postByTagSchema, RelatedPostId (+6 more)

### Community 63 - "@opentelemetry/exporter-trace-otlp-http"
Cohesion: 0.18
Nodes (14): usePostsInfiniteScroll(), postsInfiniteQueryOptions(), postsNextPageParam(), postsPreviousPageParam(), userPostsInfiniteQueryOptions(), usersKeys, FetchUserInput, fetchUserInputSchema (+6 more)

### Community 64 - "@opentelemetry/resources"
Cohesion: 0.22
Nodes (8): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Secondary, ViteSakuga

### Community 70 - "pg"
Cohesion: 0.22
Nodes (3): Additional Resources, Feature Implementation Guidelines, When Adding Features

### Community 72 - "useResponsiveColumns.ts"
Cohesion: 0.18
Nodes (11): PostWithVotes, computePagination(), PaginationInput, PaginationMeta, InfinitePostsPage, PopularTag, PostsInfiniteState, RegisteredFullPaths (+3 more)

### Community 76 - "@tanstack/db"
Cohesion: 0.25
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 80 - "@tanstack/react-form-devtools"
Cohesion: 0.40
Nodes (5): postQueryDetail(), searchPosts, useUploadDraft(), PostComponent(), RouteComponent()

### Community 96 - "@tanstack/eslint-plugin-router"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 110 - "upload.lazy.tsx"
Cohesion: 0.08
Nodes (29): SearchBoxProps, SearchBoxTagCombobox(), SearchBoxTagComboboxProps, Alert, AlertProps, BADGE_SIZES, BadgeProps, DataList (+21 more)

### Community 121 - "comments.service.ts"
Cohesion: 0.21
Nodes (13): AuthServices, testUser, CommentsService, CommentsServiceLive, CommentWithUser, CommentNotFoundError, ForbiddenError, PlaylistNotFoundError (+5 more)

### Community 122 - "index.tsx"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 124 - "errors.ts"
Cohesion: 0.33
Nodes (6): Authentication, Database, File Structure Conventions, Project Structure & File Conventions, Source Directory Layout, Upload & Storage

### Community 138 - "Route"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 143 - "feedback.tsx"
Cohesion: 0.50
Nodes (4): Agent skills, Domain docs, Issue tracker, Triage labels

### Community 144 - "comments.service.ts"
Cohesion: 0.67
Nodes (3): ignorePatterns, scripts/, *.test.*

### Community 145 - "storage.module.ts"
Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 146 - "KeyboardShortcutsDialog.tsx"
Cohesion: 0.07
Nodes (30): CommentComposer(), CommentsContent(), GlobalShortcuts(), getShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, ButtonProps (+22 more)

### Community 147 - "index.ts"
Cohesion: 0.38
Nodes (4): auth, getKyselyPool(), getPool(), Route

### Community 149 - "@cloudflare/workers-types"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, devDependencies, @cloudflare/workers-types, tailwindcss, @tanstack/devtools-vite, @tanstack/react-devtools, tailwindcss, @tanstack/devtools-vite (+1 more)

## Knowledge Gaps
- **541 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+536 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `playlists.service.ts` to `@opentelemetry/sdk-logs`, `kysely`, `rules`, `@opentelemetry/sdk-trace-base`, `@neondatabase/serverless`, `@opentelemetry/sdk-trace-web`, `react`, `better-auth`, `vite`, `effect`, `@opentelemetry/sdk-trace-base`, `media-chrome`, `tooltip.tsx`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `dotenv`, `drizzle-orm`, `@effect/eslint-plugin`, `users.index.tsx`, `@emotion/react`, `mediainfo.js`, `@opentelemetry/api`, `users.service.ts`, `useUploadForm.ts`, `playlists.schema.ts`, `postgres`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `check-password-strength`, `@tanstack/react-db`, `@tanstack/react-form`, `@effect/opentelemetry`, `@opentelemetry/exporter-trace-otlp-http`, `@tanstack/query-db-collection`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `layer-factories.server.ts`, `PGliteConnection`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Why does `InputGroup()` connect `schema.utils.ts` to `auth.hooks.ts`, `react`, `AGENT GUIDELINES FOR ViteSakuga`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `schema.utils.ts`, `playlists.service.ts`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _541 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test-utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14482758620689656 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `__root.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09146341463414634 - nodes in this community are weakly interconnected._