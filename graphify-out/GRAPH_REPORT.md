# Graph Report - vitesakuga  (2026-08-17)

## Corpus Check
- 200 files · ~89,186 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1286 nodes · 2470 edges · 147 communities (67 shown, 80 thin omitted)
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
- @types/react-dom
- @effect/eslint-plugin
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
10. ``src/lib/`` - 18 edges

## Surprising Connections (you probably didn't know these)
- `InputGroup()` --references--> `react`  [EXTRACTED]
  src/components/ui/field.tsx → package.json
- `CommentComposer()` --calls--> `useAddComment()`  [EXTRACTED]
  src/components/Comments.tsx → src/lib/comments/comments.hooks.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `PlaylistAddModal()` --calls--> `toastError()`  [EXTRACTED]
  src/components/PlaylistAddModal.tsx → src/lib/mutations/mutation-feedback.ts
- `PlaylistAddModal()` --calls--> `toastSuccess()`  [EXTRACTED]
  src/components/PlaylistAddModal.tsx → src/lib/mutations/mutation-feedback.ts

## Import Cycles
- None detected.

## Communities (147 total, 80 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.23
Nodes (12): Post(), PostDetailDisplay(), PostDetailDisplayProps, PostEditForm(), PostEditFormProps, TODO: replace with a proper unsaved-changes dialog, Field, Box() (+4 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.23
Nodes (13): AuthService, RequestHeadersService, getSessionEffect, getUserSessionEffect, KyselyDB, LOG_LAYER, makeAuthLayer(), makeDBLayer() (+5 more)

### Community 3 - "playlists.service.ts"
Cohesion: 0.15
Nodes (13): clsx, @effect/opentelemetry, neonctl, @opentelemetry/exporter-logs-otlp-http, @opentelemetry/sdk-trace-node, dependencies, clsx, @effect/opentelemetry (+5 more)

### Community 4 - "rules"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 5 - "__root.tsx"
Cohesion: 0.06
Nodes (39): CommentComposer(), CommentsContent(), PostVoteButtons, PostVoteButtonsComponent(), PostVoteButtonsProps, toaster, CommentsFnsContext, defaultCommentsFns (+31 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.13
Nodes (12): AuthSessionProvider, DB, createTestKysely(), LOG_LAYER, makeServiceTestLayer(), ServiceTestContext, EffectKysely, defaultVideoMetadata (+4 more)

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.05
Nodes (38): account, session, user, userInsertSchema, userSelectSchema, verification, commentInsertSchema, comments (+30 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.17
Nodes (15): PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, DataList, BoxProps, Grid(), GridItem() (+7 more)

### Community 9 - "scripts"
Cohesion: 0.07
Nodes (29): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+21 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.07
Nodes (35): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), InputProps, TextareaProps, INPUT_SIZES, getPasswordStrength(), PasswordInput (+27 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (47): DefaultCatchBoundary(), auth, getQueryClient(), getRouter(), Register, @tanstack/react-router, Route, Route (+39 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.16
Nodes (15): PlaylistAddModal(), PlaylistAddModalProps, Checkbox, Input(), InputGroup(), InputGroupProps, InputProps, TextareaProps (+7 more)

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
Cohesion: 0.14
Nodes (14): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, PostVotesTable (+6 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.11
Nodes (23): Comments(), CommentsProps, Pagination(), PaginationProps, Button(), buttonClasses(), ButtonProps, CloseButton() (+15 more)

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
Nodes (9): PostErrorComponent(), PostsPageLayout(), Spinner(), Stack(), Card, Text(), User(), usersCollection (+1 more)

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
Cohesion: 0.16
Nodes (12): getUserSession, SessionUser, SqlError, createHandler(), LayerShape, resolveMiddlewareLayer(), tagsKeys, tagsQueries (+4 more)

### Community 32 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 34 - "schema.utils.ts"
Cohesion: 0.18
Nodes (12): PopularTag, PopularTagsSection(), PopularTagsSectionProps, SearchBox(), Flex(), Heading(), HEADING_SIZES, Link() (+4 more)

### Community 35 - "route.tsx"
Cohesion: 0.15
Nodes (15): NotFound(), PostCardComponent(), PostListProps, Image(), Menu, Video, VideoProps, VideoRef (+7 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.15
Nodes (15): CommentDraft, commentDraftsCollection, queryClient, tagsCollection, UploadDraft, Tag, usersKeys, FetchUserInput (+7 more)

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): func-style, typescript/consistent-type-definitions, declaration, error, type

### Community 39 - "@chakra-ui/react"
Cohesion: 0.06
Nodes (44): CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError, UserNotFoundError, ValidationError (+36 more)

### Community 42 - "triage-labels.md"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Build, Lint, and Test Commands, Database Commands (Drizzle Kit), Detailed Guidelines, General Code Style Principles, General Commands, graphify, Package Manager (+4 more)

### Community 45 - "drizzle-seed"
Cohesion: 0.20
Nodes (11): postWithVotesSelectSchema, parse(), parseStrict(), updatePostInputSchema, VideoMetadataSchema, parsePostId(), PostDetailResult, PostsSearchResult (+3 more)

### Community 46 - "users.service.ts"
Cohesion: 0.24
Nodes (10): SearchBoxProps, SearchBoxTagCombobox(), SearchBoxTagComboboxProps, Badge(), Group(), Wrap(), Combobox, TagInputCombobox() (+2 more)

### Community 50 - "@electric-sql/pglite"
Cohesion: 0.18
Nodes (16): uploadDraftCollection, safeParseStrict(), postQueryDetail(), postsKeys, FormFileUploadSchema, searchPosts, uploadPost, buildFormData() (+8 more)

### Community 52 - "isomorphic-dompurify"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 54 - "kysely"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 57 - "neonctl"
Cohesion: 0.38
Nodes (11): HOVERABLE_KEYS, isStyleObject(), mapColor(), mapFilter(), mapResponsive(), mapSpacingProp(), mapVariantClasses(), spacing() (+3 more)

### Community 58 - "@neondatabase/serverless"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 59 - "next-themes"
Cohesion: 0.14
Nodes (13): CoerceNumber, FileUploadData, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, postByTagSchema, RelatedPostId (+5 more)

### Community 64 - "@opentelemetry/resources"
Cohesion: 0.22
Nodes (8): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Secondary, ViteSakuga

### Community 70 - "pg"
Cohesion: 0.22
Nodes (3): Additional Resources, Feature Implementation Guidelines, When Adding Features

### Community 72 - "useResponsiveColumns.ts"
Cohesion: 0.10
Nodes (27): PostCard, UserErrorComponent(), VirtualPostsGrid(), VirtualPostsGridProps, PostWithVotes, InfinitePostsPage, PopularTag, PostsInfiniteState (+19 more)

### Community 76 - "@tanstack/db"
Cohesion: 0.25
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 96 - "@tanstack/eslint-plugin-router"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 110 - "upload.lazy.tsx"
Cohesion: 0.11
Nodes (19): Alert, AlertProps, BADGE_SIZES, BadgeProps, OUTLINE_BADGE, Palette, Progress, Skeleton() (+11 more)

### Community 121 - "comments.service.ts"
Cohesion: 0.20
Nodes (9): AuthServices, SessionFetchError, testUser, CommentsService, CommentsServiceLive, CommentWithUser, deleteComment, commentsSelectSchema (+1 more)

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
Cohesion: 0.11
Nodes (17): GlobalShortcuts(), getShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, COLOR_MODE_OPTIONS, ColorMode, ColorModeButton (+9 more)

### Community 149 - "@cloudflare/workers-types"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, devDependencies, @cloudflare/workers-types, tailwindcss, @tanstack/devtools-vite, @tanstack/react-devtools, tailwindcss, @tanstack/devtools-vite (+1 more)

## Knowledge Gaps
- **547 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+542 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `playlists.service.ts` to `@opentelemetry/sdk-logs`, `kysely`, `rules`, `@opentelemetry/sdk-trace-base`, `@neondatabase/serverless`, `@opentelemetry/sdk-trace-web`, `react`, `better-auth`, `vite`, `effect`, `@opentelemetry/sdk-trace-base`, `media-chrome`, `tooltip.tsx`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `dotenv`, `drizzle-orm`, `@effect/eslint-plugin`, `users.index.tsx`, `@emotion/react`, `mediainfo.js`, `@opentelemetry/api`, `users.service.ts`, `@opentelemetry/exporter-trace-otlp-http`, `useUploadForm.ts`, `playlists.schema.ts`, `postgres`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `check-password-strength`, `@tanstack/react-db`, `@tanstack/react-form`, `@opentelemetry/exporter-trace-otlp-http`, `@tanstack/query-db-collection`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `layer-factories.server.ts`, `PGliteConnection`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Why does `InputGroup()` connect `AGENT GUIDELINES FOR ViteSakuga` to `neonctl`, `FileRoutesByPath`, `react`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `playlists.service.ts`, `AGENT GUIDELINES FOR ViteSakuga`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _547 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `__root.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06428571428571428 - nodes in this community are weakly interconnected._
- **Should `posts.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12631578947368421 - nodes in this community are weakly interconnected._