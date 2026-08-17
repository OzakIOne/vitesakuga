# Graph Report - vitesakuga  (2026-08-14)

## Corpus Check
- 196 files · ~78,887 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1252 nodes · 2413 edges · 159 communities (78 shown, 81 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8acaa5fd`
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
- probe.ts
- oxfmt
- playlists.schema.ts
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
- kysely
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
- users.$id.playlists.$playlistId.tsx
- @vitejs/plugin-react
- vitest
- wrangler
- upload.lazy.tsx
- drizzle.config.ts
- upload.processor.ts
- comments.service.ts
- index.tsx
- @effect/opentelemetry
- errors.ts
- layer-factories.server.ts
- useUploadForm.ts
- PGliteConnection
- @cloudflare/workers-types
- media-chrome
- @opentelemetry/sdk-logs
- kysely
- @neondatabase/serverless
- @opentelemetry/sdk-trace-base
- tailwind-merge
- Route
- Route
- better-auth
- Route
- @effect/opentelemetry
- neonctl
- @opentelemetry/sdk-trace-web
- safelist.ts
- feedback.tsx
- comments.service.ts
- storage.module.ts
- probe.ts
- server-fn.handler.ts
- @ark-ui/react
- @cloudflare/workers-types
- tailwindcss
- @tanstack/eslint-plugin-router
- vite
- triage-labels.md
- @opentelemetry/sdk-trace-base
- oxlint
- knip
- @types/react
- typescript

## God Nodes (most connected - your core abstractions)
1. `cx()` - 38 edges
2. `useChakraProps()` - 38 edges
3. `scripts` - 32 edges
4. `compilerOptions` - 29 edges
5. `Box()` - 24 edges
6. `useMutationWithFeedback()` - 23 edges
7. `rules` - 22 edges
8. `Text()` - 22 edges
9. `Button()` - 20 edges
10. `FileRoutesByPath` - 17 edges

## Surprising Connections (you probably didn't know these)
- `InputGroup()` --references--> `react`  [EXTRACTED]
  src/components/ui/field.tsx → package.json
- `useControllableState()` --references--> `react`  [EXTRACTED]
  src/components/ui/password-input.tsx → package.json
- `Spinner()` --calls--> `cx()`  [EXTRACTED]
  src/components/ui/button.tsx → src/components/ui/ui-utils.ts
- `makeDBLayer()` --indirect_call--> `KyselyDB`  [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/db/context.ts
- `makeTestLayer()` --indirect_call--> `KyselyDB`  [INFERRED]
  src/lib/db/test-utils.ts → src/lib/db/context.ts

## Import Cycles
- None detected.

## Communities (159 total, 81 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.13
Nodes (19): Pagination(), PaginationProps, PostCard, PostDetailDisplay(), PostErrorComponent(), PostsPageLayout(), Spinner(), GridItem() (+11 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.20
Nodes (15): AuthService, AuthSessionProvider, RequestHeadersService, getSessionEffect, getUserSessionEffect, LOG_LAYER, makeAuthLayer(), makeDBLayer() (+7 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.14
Nodes (14): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, PostVotesTable (+6 more)

### Community 4 - "rules"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 5 - "__root.tsx"
Cohesion: 0.11
Nodes (17): GlobalShortcuts(), getShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, ButtonProps, IconButton(), ColorMode (+9 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.09
Nodes (21): CommentsInsert, commentsInsertSchema, CommentsSelect, commentsSelectSchema, DbSchemaInsert, DbSchemaSelect, playlistPostsInsertSchema, playlistPostsSelectSchema (+13 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.18
Nodes (11): CommentDraft, commentDraftsCollection, queryClient, tagsCollection, UploadDraft, uploadDraftCollection, usersCollection, Tag (+3 more)

### Community 9 - "scripts"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.10
Nodes (28): FieldInfo(), Avatar, PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, createWrapper() (+20 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (25): AccountRoute, ApiAuthSplatRoute, authLoginRoute, authRouteRoute, authRouteRouteChildren, authRouteRouteWithChildren, authSignupRoute, ConvertRoute (+17 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.12
Nodes (17): Comments(), CommentsProps, Button(), buttonClasses(), CloseButton(), GHOST_CLASSES, ICON_SIZES, OUTLINE_CLASSES (+9 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.10
Nodes (20): rules, @effect/dprint, @effect/no-import-from-barrel-package, jsx-a11y/media-has-caption, jsx-a11y/no-autofocus, max-statements, no-void, react-perf/jsx-no-new-function-as-prop (+12 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.20
Nodes (18): EFFECT_KYSELY_MARKER, EffectExecutor, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan() (+10 more)

### Community 16 - "opencode.json"
Cohesion: 0.08
Nodes (24): command, type, path, description, repository, description, repository, lsp (+16 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.12
Nodes (18): RouteComponent(), clampVideoQuality(), ConvertContext, ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertMachineLogic, ConvertProgressEvent (+10 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.24
Nodes (12): PlaylistAddModal(), errorMessage(), MutationFeedbackOptions, toastError(), toastSuccess(), useMutationWithFeedback(), PlaylistsFnsContext, useAddPostToPlaylist() (+4 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.13
Nodes (14): CoerceNumber, FileUploadData, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, PostByTagParams, postByTagSchema (+6 more)

### Community 21 - "router.tsx"
Cohesion: 0.17
Nodes (11): extends, jsPlugins, options, typeAware, typeCheck, $schema, @effect/eslint-plugin, ./node_modules/@effect/tsgo/oxlint-presets/correctness.json (+3 more)

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 24 - "ViteSakuga"
Cohesion: 0.31
Nodes (9): PostVoteButtons, PostVoteButtonsComponent(), PostVoteButtonsProps, PostVote, applyVote(), PostVotesSummary, usePostVotes(), useSetVote() (+1 more)

### Community 25 - "DB"
Cohesion: 0.17
Nodes (12): plugins, eslint, import, jsx-a11y, node, oxc, promise, react (+4 more)

### Community 26 - "knip.json"
Cohesion: 0.25
Nodes (7): entry, ignore, project, $schema, **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 27 - "index.tsx"
Cohesion: 0.23
Nodes (8): KyselyDB, SqlError, tagsKeys, tagsQueries, getAllPopularTags, getAllTags, TagsService, TagsServiceLive

### Community 28 - "vitest.setup.ts"
Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureRustFS, exec(), isRunning, waitForHealth

### Community 29 - "Domain Docs"
Cohesion: 0.27
Nodes (8): AuthServices, SessionFetchError, postVoteSchema, RemovePostVoteInput, removePostVoteSchema, SetPostVoteInput, setPostVoteSchema, PostVotesSummary

### Community 30 - "Issue tracker: GitHub"
Cohesion: 0.15
Nodes (14): postWithVotesSelectSchema, EffectKysely, mapPopularTags(), usersKeys, usersQueries, FetchUserInput, fetchUserInputSchema, UserPublic (+6 more)

### Community 32 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 33 - "tooltip.tsx"
Cohesion: 0.08
Nodes (24): Alert, AlertProps, BADGE_SIZES, BadgeProps, DataList, OUTLINE_BADGE, Palette, Progress (+16 more)

### Community 34 - "schema.utils.ts"
Cohesion: 0.10
Nodes (26): FormTextareaFieldProps, FormTextWrapper(), InputProps, TextareaProps, PostEditForm(), PostEditFormProps, TODO: replace with a proper unsaved-changes dialog, Checkbox (+18 more)

### Community 35 - "route.tsx"
Cohesion: 0.12
Nodes (25): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, SearchBox() (+17 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.19
Nodes (11): CommentsContent(), CommentsFnsContext, defaultCommentsFns, useAddComment(), useDeleteComment(), commentsKeys, commentsQueries, commentsQueryGetComments() (+3 more)

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): func-style, typescript/consistent-type-definitions, declaration, error, type

### Community 39 - "@chakra-ui/react"
Cohesion: 0.17
Nodes (14): defaultPlaylistsFns, removePostFromPlaylistInputSchema, addPostToPlaylist, createPlaylist, deletePlaylist, PlaylistDetailResult, PlaylistForPostCheck, PlaylistPostRow (+6 more)

### Community 41 - "@cloudflare/workers-types"
Cohesion: 0.20
Nodes (8): commentInsertSchema, comments, playlistPosts, playlists, posts, postTags, postVotes, tags

### Community 42 - "triage-labels.md"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Build, Lint, and Test Commands, Database Commands (Drizzle Kit), Detailed Guidelines, General Code Style Principles, General Commands, graphify, Package Manager (+4 more)

### Community 43 - "dotenv"
Cohesion: 0.26
Nodes (10): toaster, VideoMetadata, analyzeVideo(), generateAutoThumbnails(), GeneratedThumbnail, generateThumbnails(), makeReadChunk(), useVideoProcessing() (+2 more)

### Community 44 - "drizzle-orm"
Cohesion: 0.15
Nodes (3): DB, PGliteConnection, PGliteDialect

### Community 45 - "drizzle-seed"
Cohesion: 0.26
Nodes (9): parse(), parseStrict(), updatePostInputSchema, VideoMetadataSchema, getPostsByTag, parsePostId(), PostDetailResult, PostsSearchResult (+1 more)

### Community 46 - "users.service.ts"
Cohesion: 0.17
Nodes (11): Route, Route, Route, Route, Route, Route, Route, Route (+3 more)

### Community 52 - "isomorphic-dompurify"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 53 - "users.index.tsx"
Cohesion: 0.20
Nodes (8): defaultVotesFns, VotesFnsContext, summary, votesKeys, votesQueries, fetchPostVotes, removePostVote, setPostVote

### Community 54 - "kysely"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 55 - "@emotion/react"
Cohesion: 0.11
Nodes (12): testUser, CommentsService, CommentsServiceLive, createTestKysely(), makeServiceTestLayer(), defaultVideoMetadata, testUser, PostsService (+4 more)

### Community 58 - "@neondatabase/serverless"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 59 - "next-themes"
Cohesion: 0.15
Nodes (13): clsx, next-themes, @opentelemetry/resources, pg, tailwind-merge, @tanstack/db, dependencies, clsx (+5 more)

### Community 64 - "@opentelemetry/resources"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Patches, Secondary (+1 more)

### Community 69 - "playlists.schema.ts"
Cohesion: 0.24
Nodes (8): addPostToPlaylistInputSchema, createPlaylistInputSchema, fetchPlaylistDetailSchema, reorderPlaylistPostsInputSchema, sanitizeString(), updatePlaylistInputSchema, sanitizeString(), sanitize()

### Community 70 - "pg"
Cohesion: 0.22
Nodes (3): Additional Resources, Feature Implementation Guidelines, When Adding Features

### Community 72 - "react"
Cohesion: 0.20
Nodes (9): account, session, user, userInsertSchema, userSelectSchema, verification, postsSelectSchema, postRow (+1 more)

### Community 76 - "@tanstack/db"
Cohesion: 0.25
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 96 - "@tanstack/eslint-plugin-router"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 103 - "@types/react"
Cohesion: 0.29
Nodes (6): PostWithVotes, computePagination(), PaginationInput, PaginationMeta, PopularTag, PostListingData

### Community 105 - "typescript"
Cohesion: 0.25
Nodes (7): PLAYLIST_QUERY_CACHE, playlistsKeys, playlistsQueries, playlistsQueryForPost(), fetchPlaylistDetail, fetchPlaylistsForPost, fetchUserPlaylists

### Community 106 - "users.$id.playlists.$playlistId.tsx"
Cohesion: 0.14
Nodes (21): NotFound(), PlaylistAddModalProps, Post(), PostCardComponent(), PostListProps, PostDetailDisplayProps, Box(), BoxProps (+13 more)

### Community 110 - "upload.lazy.tsx"
Cohesion: 0.15
Nodes (24): Center(), Grid(), mapResponsiveColumns(), mapTemplateColumns(), SimpleGrid(), Span(), AVATAR_SIZES, AvatarGroup() (+16 more)

### Community 120 - "upload.processor.ts"
Cohesion: 0.38
Nodes (5): getUserSession, SessionUser, createHandler(), LayerShape, resolveMiddlewareLayer()

### Community 121 - "comments.service.ts"
Cohesion: 0.26
Nodes (10): CommentWithUser, SqlNoFirstResult, CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError (+2 more)

### Community 122 - "index.tsx"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 124 - "errors.ts"
Cohesion: 0.33
Nodes (6): Authentication, Database, File Structure Conventions, Project Structure & File Conventions, Source Directory Layout, Upload & Storage

### Community 129 - "media-chrome"
Cohesion: 0.43
Nodes (6): safeParseStrict(), FormFileUploadSchema, uploadPost, buildFormData(), useUploadForm(), UseUploadFormParams

### Community 134 - "tailwind-merge"
Cohesion: 0.33
Nodes (4): testUser, testUser2, PlaylistsService, PlaylistsServiceLive

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

### Community 146 - "probe.ts"
Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

### Community 147 - "server-fn.handler.ts"
Cohesion: 0.67
Nodes (3): react, useControllableState(), react

### Community 149 - "@cloudflare/workers-types"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, tailwindcss, @tanstack/eslint-plugin-router, devDependencies, @cloudflare/workers-types, tailwindcss, @tanstack/eslint-plugin-router, vite (+1 more)

## Knowledge Gaps
- **539 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+534 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **81 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `next-themes` to `@opentelemetry/sdk-logs`, `kysely`, `playlists.service.ts`, `@opentelemetry/sdk-trace-base`, `@neondatabase/serverless`, `rules`, `better-auth`, `@effect/opentelemetry`, `neonctl`, `@opentelemetry/sdk-trace-web`, `dependencies`, `server-fn.handler.ts`, `@ark-ui/react`, `@tanstack/eslint-plugin-router`, `vite`, `triage-labels.md`, `@opentelemetry/sdk-trace-base`, `@emotion/react`, `mediainfo.js`, `@opentelemetry/api`, `users.service.ts`, `@opentelemetry/exporter-trace-otlp-http`, `useUploadForm.ts`, `@opentelemetry/sdk-trace-node`, `postgres`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `layer-factories.server.ts`, `PGliteConnection`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Why does `react` connect `server-fn.handler.ts` to `schema.utils.ts`, `next-themes`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `InputGroup()` connect `schema.utils.ts` to `auth.hooks.ts`, `server-fn.handler.ts`, `upload.lazy.tsx`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _539 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `posts.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12873563218390804 - nodes in this community are weakly interconnected._
- **Should `upload.lazy.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._