# Graph Report - vitesakuga  (2026-08-17)

## Corpus Check
- 200 files · ~87,962 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1283 nodes · 2465 edges · 162 communities (77 shown, 85 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `521ab4be`
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
- effect
- @types/react-dom
- @effect/eslint-plugin
- users.$id.playlists.$playlistId.tsx
- @vitejs/plugin-react
- vitest
- wrangler
- upload.lazy.tsx
- drizzle.config.ts
- upload.lazy.tsx
- comments.service.ts
- index.tsx
- @effect/opentelemetry
- errors.ts
- layer-factories.server.ts
- useUploadForm.ts
- PGliteConnection
- @cloudflare/workers-types
- __root.tsx
- @opentelemetry/sdk-logs
- kysely
- @neondatabase/serverless
- @opentelemetry/sdk-trace-base
- auth.schemas.ts
- votes.hooks.test.tsx
- password-input.tsx
- Route
- comments.fn-context.tsx
- neonctl
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
- @opentelemetry/exporter-logs-otlp-http
- @opentelemetry/sdk-trace-node

## God Nodes (most connected - your core abstractions)
1. `cx()` - 38 edges
2. `useChakraProps()` - 38 edges
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
- `useControllableState()` --references--> `react`  [EXTRACTED]
  src/components/ui/password-input.tsx → package.json
- `Spinner()` --calls--> `cx()`  [EXTRACTED]
  src/components/ui/button.tsx → src/components/ui/ui-utils.ts
- `CommentComposer()` --calls--> `useAddComment()`  [EXTRACTED]
  src/components/Comments.tsx → src/lib/comments/comments.hooks.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx

## Import Cycles
- None detected.

## Communities (162 total, 85 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.16
Nodes (17): InfinitePostsPage, PopularTag, PostsInfiniteState, RegisteredFullPaths, usePostsInfiniteScroll(), computeAnchorPostIndex(), PostsInfinitePage, postsInfiniteQueryOptions() (+9 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.20
Nodes (16): AuthService, AuthSessionProvider, RequestHeadersService, KyselyDB, LOG_LAYER, makeAuthLayer(), makeDBLayer(), makeMiddlewareLayer() (+8 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.10
Nodes (18): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, PostVotesTable (+10 more)

### Community 4 - "rules"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 5 - "__root.tsx"
Cohesion: 0.22
Nodes (14): PlaylistAddModal(), PlaylistAddModalProps, errorMessage(), MutationFeedbackOptions, toastError(), toastSuccess(), useMutationWithFeedback(), PlaylistsFnsContext (+6 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.09
Nodes (21): CommentsInsert, commentsInsertSchema, CommentsSelect, DbSchemaInsert, DbSchemaSelect, playlistPostsInsertSchema, playlistPostsSelectSchema, playlistsInsertSchema (+13 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.14
Nodes (18): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, SearchBox() (+10 more)

### Community 9 - "scripts"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.23
Nodes (12): createWrapper(), useChangePassword(), useDeleteAccount(), useLogin(), useSignUp(), useSocialLogin(), useUpdateProfile(), authClient (+4 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (25): AccountRoute, ApiAuthSplatRoute, authLoginRoute, authRouteRoute, authRouteRouteChildren, authRouteRouteWithChildren, authSignupRoute, ConvertRoute (+17 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.19
Nodes (12): FieldInfo(), FormTextareaFieldProps, InputProps, TextareaProps, Checkbox, Field, Input(), INPUT_SIZES (+4 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.10
Nodes (20): rules, @effect/dprint, @effect/no-import-from-barrel-package, jsx-a11y/media-has-caption, jsx-a11y/no-autofocus, max-statements, no-void, react-perf/jsx-no-new-function-as-prop (+12 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.18
Nodes (19): EFFECT_KYSELY_MARKER, EffectExecutor, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan() (+11 more)

### Community 16 - "opencode.json"
Cohesion: 0.06
Nodes (36): command, type, headers, type, url, path, description, repository (+28 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.12
Nodes (18): RouteComponent(), clampVideoQuality(), ConvertContext, ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertMachineLogic, ConvertProgressEvent (+10 more)

### Community 18 - "dependencies"
Cohesion: 0.22
Nodes (8): account, session, userInsertSchema, userSelectSchema, verification, postsSelectSchema, postRow, TimestampSchema

### Community 19 - "FileRoutesByPath"
Cohesion: 0.16
Nodes (16): FormTextWrapper(), Post(), PostDetailDisplay(), PostDetailDisplayProps, PostEditForm(), PostEditFormProps, TODO: replace with a proper unsaved-changes dialog, SearchBoxTagCombobox() (+8 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.06
Nodes (43): toaster, CommentDraft, queryClient, tagsCollection, UploadDraft, uploadDraftCollection, usersCollection, safeParseStrict() (+35 more)

### Community 21 - "router.tsx"
Cohesion: 0.17
Nodes (11): extends, jsPlugins, options, typeAware, typeCheck, $schema, @effect/eslint-plugin, ./node_modules/@effect/tsgo/oxlint-presets/correctness.json (+3 more)

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 24 - "ViteSakuga"
Cohesion: 0.19
Nodes (13): CommentComposer(), Comments(), CommentsContent(), CommentsProps, CloseButton(), Dialog, useAddComment(), useDeleteComment() (+5 more)

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
Cohesion: 0.24
Nodes (9): AuthServices, testUser, RemovePostVoteInput, removePostVoteSchema, SetPostVoteInput, setPostVoteSchema, PostVotesService, PostVotesServiceLive (+1 more)

### Community 30 - "Issue tracker: GitHub"
Cohesion: 0.11
Nodes (19): DB, postWithVotesSelectSchema, EffectKysely, SqlError, tagsKeys, tagsQueries, getAllPopularTags, getAllTags (+11 more)

### Community 32 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 33 - "tooltip.tsx"
Cohesion: 0.10
Nodes (20): Alert, AlertProps, BADGE_SIZES, BadgeProps, OUTLINE_BADGE, Palette, Progress, SkeletonProps (+12 more)

### Community 34 - "schema.utils.ts"
Cohesion: 0.21
Nodes (13): Tooltip, TooltipProps, HOVERABLE_KEYS, isStyleObject(), mapColor(), mapFilter(), mapResponsive(), mapSpacingProp() (+5 more)

### Community 35 - "route.tsx"
Cohesion: 0.14
Nodes (17): Pagination(), PaginationProps, HStack(), Stack(), Avatar, AVATAR_SIZES, Card, ImageProps (+9 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.24
Nodes (11): PostVoteButtons, PostVoteButtonsComponent(), PostVoteButtonsProps, PostVote, applyVote(), PostVotesSummary, usePostVotes(), useSetVote() (+3 more)

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): func-style, typescript/consistent-type-definitions, declaration, error, type

### Community 39 - "@chakra-ui/react"
Cohesion: 0.10
Nodes (32): CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError, UserNotFoundError, ValidationError (+24 more)

### Community 41 - "@cloudflare/workers-types"
Cohesion: 0.18
Nodes (9): user, commentInsertSchema, comments, playlistPosts, playlists, posts, postTags, postVotes (+1 more)

### Community 42 - "triage-labels.md"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Build, Lint, and Test Commands, Database Commands (Drizzle Kit), Detailed Guidelines, General Code Style Principles, General Commands, graphify, Package Manager (+4 more)

### Community 45 - "drizzle-seed"
Cohesion: 0.13
Nodes (14): parse(), parseStrict(), computePagination(), PaginationInput, PaginationMeta, defaultVideoMetadata, testUser, updatePostInputSchema (+6 more)

### Community 46 - "users.service.ts"
Cohesion: 0.17
Nodes (12): Route, Route, Route, Route, Route, Route, Route, Route (+4 more)

### Community 52 - "isomorphic-dompurify"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 54 - "kysely"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 58 - "@neondatabase/serverless"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 63 - "@opentelemetry/exporter-trace-otlp-http"
Cohesion: 0.16
Nodes (10): ButtonProps, ColorMode, ColorModeButton, ColorModeButtonProps, ColorModeProviderProps, useColorMode(), UseColorModeReturn, useColorModeValue() (+2 more)

### Community 64 - "@opentelemetry/resources"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Patches, Secondary (+1 more)

### Community 66 - "@opentelemetry/sdk-trace-node"
Cohesion: 0.19
Nodes (10): NotFound(), PostErrorComponent(), PostsPageLayout(), UserErrorComponent(), VirtualPostsGrid(), toStandardSchemaV1Strict(), searchPostsBaseSchema, BreakpointColumn (+2 more)

### Community 67 - "probe.ts"
Cohesion: 0.18
Nodes (10): buttonClasses(), GHOST_CLASSES, ICON_SIZES, OUTLINE_CLASSES, Palette, SIZES, SOLID_CLASSES, Spinner() (+2 more)

### Community 70 - "pg"
Cohesion: 0.22
Nodes (3): Additional Resources, Feature Implementation Guidelines, When Adding Features

### Community 76 - "@tanstack/db"
Cohesion: 0.25
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 84 - "@tanstack/react-query"
Cohesion: 0.15
Nodes (13): @ark-ui/react, @effect/opentelemetry, @opentelemetry/exporter-trace-otlp-http, dependencies, @ark-ui/react, @effect/opentelemetry, @opentelemetry/exporter-trace-otlp-http, @tanstack/db (+5 more)

### Community 96 - "@tanstack/eslint-plugin-router"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 106 - "users.$id.playlists.$playlistId.tsx"
Cohesion: 0.23
Nodes (10): PostCard, PostCardComponent(), PostListProps, Box(), VirtualPostsGridProps, assetUrl(), PostWithVotes, playlistsQueryUserPlaylists() (+2 more)

### Community 110 - "upload.lazy.tsx"
Cohesion: 0.23
Nodes (20): Skeleton(), Spinner(), InputGroup(), BoxProps, Center(), Container(), Flex(), Grid() (+12 more)

### Community 120 - "upload.lazy.tsx"
Cohesion: 0.27
Nodes (9): Video, VideoProps, VideoRef, postQueryDetail(), searchPosts, useUploadDraft(), PostComponent(), Route (+1 more)

### Community 121 - "comments.service.ts"
Cohesion: 0.17
Nodes (13): getUserSession, getSessionEffect, getUserSessionEffect, SessionFetchError, SessionUser, testUser, CommentsService, CommentsServiceLive (+5 more)

### Community 122 - "index.tsx"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 124 - "errors.ts"
Cohesion: 0.33
Nodes (6): Authentication, Database, File Structure Conventions, Project Structure & File Conventions, Source Directory Layout, Upload & Storage

### Community 129 - "__root.tsx"
Cohesion: 0.31
Nodes (4): GlobalShortcuts(), IconButton(), defaultPlaylistsFns, seo()

### Community 134 - "auth.schemas.ts"
Cohesion: 0.33
Nodes (7): Email, loginSchema, PasswordMatch, passwordSchema, profileSchema, signUpSchema, Url

### Community 135 - "votes.hooks.test.tsx"
Cohesion: 0.28
Nodes (6): defaultVotesFns, VotesFnsContext, summary, fetchPostVotes, removePostVote, setPostVote

### Community 137 - "password-input.tsx"
Cohesion: 0.25
Nodes (5): PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps

### Community 138 - "Route"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 139 - "comments.fn-context.tsx"
Cohesion: 0.33
Nodes (4): CommentsFnsContext, defaultCommentsFns, addComment, deleteComment

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
Cohesion: 0.40
Nodes (4): getShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut

### Community 148 - "react"
Cohesion: 0.67
Nodes (3): react, react, useControllableState()

### Community 149 - "@cloudflare/workers-types"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, devDependencies, @cloudflare/workers-types, tailwindcss, @tanstack/eslint-plugin-router, vite, tailwindcss, @tanstack/eslint-plugin-router (+1 more)

## Knowledge Gaps
- **545 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+540 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **85 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `@tanstack/react-query` to `@opentelemetry/sdk-logs`, `playlists.service.ts`, `rules`, `@opentelemetry/sdk-trace-base`, `kysely`, `@neondatabase/serverless`, `neonctl`, `@opentelemetry/sdk-trace-web`, `react`, `better-auth`, `vite`, `effect`, `@opentelemetry/sdk-trace-base`, `media-chrome`, `@opentelemetry/exporter-logs-otlp-http`, `@opentelemetry/sdk-trace-node`, `dotenv`, `@effect/eslint-plugin`, `@emotion/react`, `users.index.tsx`, `@emotion/react`, `mediainfo.js`, `next-themes`, `@opentelemetry/api`, `users.service.ts`, `useUploadForm.ts`, `playlists.schema.ts`, `postgres`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `layer-factories.server.ts`, `PGliteConnection`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `@tanstack/react-query`, `upload.lazy.tsx`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `InputGroup()` connect `upload.lazy.tsx` to `auth.hooks.ts`, `react`, `AGENT GUIDELINES FOR ViteSakuga`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _545 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `upload.lazy.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09956709956709957 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `sakuga.utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._