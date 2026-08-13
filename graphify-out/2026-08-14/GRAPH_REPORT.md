# Graph Report - vitesakuga-posts-likes  (2026-08-14)

## Corpus Check
- 196 files · ~78,402 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1242 nodes · 2393 edges · 152 communities (71 shown, 81 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

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
- @cloudflare/workers-types
- tailwindcss
- @tanstack/eslint-plugin-router
- vite
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `cx()` - 38 edges
2. `useChakraProps()` - 38 edges
3. `scripts` - 32 edges
4. `compilerOptions` - 29 edges
5. `Box()` - 24 edges
6. `useMutationWithFeedback()` - 23 edges
7. `rules` - 22 edges
8. `Text()` - 22 edges
9. `Button()` - 21 edges
10. `FileRoutesByPath` - 17 edges

## Surprising Connections (you probably didn't know these)
- `InputGroup()` --references--> `react`  [EXTRACTED]
  src/components/ui/field.tsx → package.json
- `useControllableState()` --references--> `react`  [EXTRACTED]
  src/components/ui/password-input.tsx → package.json
- `Spinner()` --calls--> `cx()`  [EXTRACTED]
  src/components/ui/button.tsx → src/components/ui/ui-utils.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `PostCardComponent()` --calls--> `assetUrl()`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/assets/url.ts

## Import Cycles
- None detected.

## Communities (152 total, 81 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.11
Nodes (22): NotFound(), PostCard, PostListProps, PostErrorComponent(), PostsPageLayout(), Spinner(), GridItem(), User() (+14 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.16
Nodes (19): AuthService, AuthSessionProvider, RequestHeadersService, getSessionEffect, getUserSessionEffect, SessionFetchError, KyselyDB, LOG_LAYER (+11 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.14
Nodes (14): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, PostVotesTable (+6 more)

### Community 4 - "rules"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 5 - "__root.tsx"
Cohesion: 0.05
Nodes (41): CommentsContent(), CommentsProps, GlobalShortcuts(), getShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, IconButton() (+33 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.10
Nodes (19): CommentsInsert, commentsInsertSchema, CommentsSelect, DbSchemaInsert, playlistPostsInsertSchema, playlistPostsSelectSchema, playlistsInsertSchema, playlistsSelectSchema (+11 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.13
Nodes (17): Combobox, TagInput(), TagInputProps, CommentDraft, commentDraftsCollection, queryClient, tagsCollection, UploadDraft (+9 more)

### Community 9 - "scripts"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.07
Nodes (34): react, react, PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, useControllableState() (+26 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (25): AccountRoute, ApiAuthSplatRoute, authLoginRoute, authRouteRoute, authRouteRouteChildren, authRouteRouteWithChildren, authSignupRoute, ConvertRoute (+17 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.10
Nodes (21): Comments(), Post(), PostDetailDisplay(), PostDetailDisplayProps, Button(), buttonClasses(), ButtonProps, CloseButton() (+13 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.10
Nodes (20): rules, @effect/dprint, @effect/no-import-from-barrel-package, jsx-a11y/media-has-caption, jsx-a11y/no-autofocus, max-statements, no-void, react-perf/jsx-no-new-function-as-prop (+12 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.20
Nodes (18): EFFECT_KYSELY_MARKER, EffectExecutor, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan() (+10 more)

### Community 16 - "opencode.json"
Cohesion: 0.11
Nodes (18): .opencode/plugins/graphify.js, path, description, repository, description, repository, lsp, mcp (+10 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.08
Nodes (28): Collapsible, Dialog, FileUpload, Menu, Popover, Select, Slider, ActorLike (+20 more)

### Community 18 - "dependencies"
Cohesion: 0.15
Nodes (13): alchemy, @ark-ui/react, effect, isomorphic-dompurify, @opentelemetry/exporter-logs-otlp-http, @opentelemetry/sdk-trace-base, dependencies, alchemy (+5 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.05
Nodes (56): PlaylistAddModal(), PlaylistAddModalProps, CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError (+48 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.15
Nodes (12): CoerceNumber, FileUploadData, FormFileUploadTextSchema, HttpsUrl, MinLen3, OptionalString, RelatedPostId, TagSchema (+4 more)

### Community 21 - "router.tsx"
Cohesion: 0.17
Nodes (11): @effect/eslint-plugin, scripts/, @tanstack/eslint-plugin-query, @tanstack/eslint-plugin-router, *.test.*, ignorePatterns, jsPlugins, options (+3 more)

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 24 - "ViteSakuga"
Cohesion: 0.18
Nodes (14): PostVoteButtons, PostVoteButtonsComponent(), PostVoteButtonsProps, PostVote, VotesFnsContext, applyVote(), PostVotesSummary, summary (+6 more)

### Community 25 - "DB"
Cohesion: 0.17
Nodes (12): eslint, import, jsx-a11y, node, oxc, promise, react, react-perf (+4 more)

### Community 26 - "knip.json"
Cohesion: 0.25
Nodes (7): **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx, entry, ignore, project, $schema

### Community 27 - "index.tsx"
Cohesion: 0.19
Nodes (10): getUserSession, SessionUser, createHandler(), LayerShape, resolveMiddlewareLayer(), tagsKeys, tagsQueries, getAllPopularTags (+2 more)

### Community 28 - "vitest.setup.ts"
Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureRustFS, exec(), isRunning, waitForHealth

### Community 29 - "Domain Docs"
Cohesion: 0.18
Nodes (12): postVoteSchema, defaultVotesFns, testUser, RemovePostVoteInput, removePostVoteSchema, SetPostVoteInput, setPostVoteSchema, PostVotesService (+4 more)

### Community 30 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): postWithVotesSelectSchema, EffectKysely, mapPopularTags(), UsersService, UsersServiceLive, fetchPostVoteCounts, VoteCountsMap

### Community 32 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 33 - "tooltip.tsx"
Cohesion: 0.17
Nodes (25): Checkbox, Input(), INPUT_SIZES, InputGroup(), InputGroupProps, InputProps, Textarea(), TextareaProps (+17 more)

### Community 34 - "schema.utils.ts"
Cohesion: 0.21
Nodes (12): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), InputProps, TextareaProps, Field, postQueryDetail(), searchPosts (+4 more)

### Community 35 - "route.tsx"
Cohesion: 0.16
Nodes (18): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, SearchBox() (+10 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Agent skills, Detailed Guidelines, Domain docs, General Code Style Principles, graphify, Issue tracker, Package Manager (+4 more)

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): declaration, error, type, func-style, typescript/consistent-type-definitions

### Community 39 - "@chakra-ui/react"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 40 - "@cloudflare/vite-plugin"
Cohesion: 0.22
Nodes (9): @cloudflare/vite-plugin, oxlint, devDependencies, @cloudflare/vite-plugin, oxlint, @types/react, typescript, @types/react (+1 more)

### Community 41 - "@cloudflare/workers-types"
Cohesion: 0.20
Nodes (8): commentInsertSchema, comments, playlistPosts, playlists, posts, postTags, postVotes, tags

### Community 42 - "triage-labels.md"
Cohesion: 0.39
Nodes (5): Avatar, AVATAR_SIZES, AvatarGroup(), Card, ImageProps

### Community 43 - "dotenv"
Cohesion: 0.24
Nodes (11): toaster, VideoMetadata, VideoMetadataSchema, analyzeVideo(), generateAutoThumbnails(), GeneratedThumbnail, generateThumbnails(), makeReadChunk() (+3 more)

### Community 44 - "drizzle-orm"
Cohesion: 0.15
Nodes (3): DB, PGliteConnection, PGliteDialect

### Community 45 - "drizzle-seed"
Cohesion: 0.26
Nodes (9): parse(), parseStrict(), FormFileUploadSchema, postByTagSchema, updatePostInputSchema, parsePostId(), PostDetailResult, PostsSearchResult (+1 more)

### Community 46 - "users.service.ts"
Cohesion: 0.17
Nodes (11): Route, Route, Route, Route, Route, Route, Route, Route (+3 more)

### Community 52 - "isomorphic-dompurify"
Cohesion: 0.24
Nodes (9): PostEditForm(), PostEditFormProps, TODO: replace with a proper unsaved-changes dialog, postsKeys, postsQueries, PostByTagParams, fetchPostDetail, getPostsByTag (+1 more)

### Community 53 - "users.index.tsx"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 54 - "kysely"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 55 - "@emotion/react"
Cohesion: 0.25
Nodes (4): defaultVideoMetadata, testUser, PostsService, PostsServiceLive

### Community 58 - "@neondatabase/serverless"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Patches, Secondary (+1 more)

### Community 72 - "react"
Cohesion: 0.20
Nodes (9): account, session, user, userInsertSchema, userSelectSchema, verification, postsSelectSchema, postRow (+1 more)

### Community 103 - "@types/react"
Cohesion: 0.22
Nodes (3): Additional Resources, Feature Implementation Guidelines, When Adding Features

### Community 105 - "typescript"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 106 - "users.$id.playlists.$playlistId.tsx"
Cohesion: 0.24
Nodes (11): Pagination(), PaginationProps, PostCardComponent(), HStack(), Text(), assetUrl(), playlistQueryDetail(), playlistsQueryUserPlaylists() (+3 more)

### Community 110 - "upload.lazy.tsx"
Cohesion: 0.23
Nodes (12): Tooltip, TooltipProps, HOVERABLE_KEYS, isStyleObject(), mapColor(), mapFilter(), mapResponsive(), mapSpacingProp() (+4 more)

### Community 120 - "upload.processor.ts"
Cohesion: 0.29
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 121 - "comments.service.ts"
Cohesion: 0.22
Nodes (8): AuthServices, testUser, CommentsService, CommentsServiceLive, CommentWithUser, commentsSelectSchema, SqlError, SqlNoFirstResult

### Community 122 - "index.tsx"
Cohesion: 0.29
Nodes (6): Authentication, Database, File Structure Conventions, Project Structure & File Conventions, Source Directory Layout, Upload & Storage

### Community 129 - "media-chrome"
Cohesion: 0.53
Nodes (5): safeParseStrict(), uploadPost, buildFormData(), useUploadForm(), UseUploadFormParams

### Community 138 - "Route"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 143 - "feedback.tsx"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 144 - "comments.service.ts"
Cohesion: 0.50
Nodes (4): Build, Lint, and Test Commands, Database Commands (Drizzle Kit), General Commands, Testing

### Community 145 - "storage.module.ts"
Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 146 - "probe.ts"
Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

### Community 147 - "server-fn.handler.ts"
Cohesion: 0.67
Nodes (3): ./node_modules/@effect/tsgo/oxlint-presets/correctness.json, ./node_modules/@effect/tsgo/oxlint-presets/effect-native.json, extends

## Knowledge Gaps
- **533 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+528 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **81 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `@opentelemetry/sdk-logs`, `kysely`, `playlists.service.ts`, `@opentelemetry/sdk-trace-base`, `@neondatabase/serverless`, `tailwind-merge`, `scripts`, `better-auth`, `@effect/opentelemetry`, `neonctl`, `@opentelemetry/sdk-trace-web`, `auth.hooks.ts`, `@emotion/react`, `mediainfo.js`, `next-themes`, `@opentelemetry/api`, `users.service.ts`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `useUploadForm.ts`, `@opentelemetry/sdk-trace-node`, `pg`, `postgres`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/db`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `errors.ts`, `layer-factories.server.ts`, `PGliteConnection`?**
  _High betweenness centrality (0.222) - this node is a cross-community bridge._
- **Why does `react` connect `auth.hooks.ts` to `tooltip.tsx`, `dependencies`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `InputGroup()` connect `tooltip.tsx` to `triage-labels.md`, `auth.hooks.ts`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _533 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `posts.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11092436974789915 - nodes in this community are weakly interconnected._
- **Should `upload.lazy.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._