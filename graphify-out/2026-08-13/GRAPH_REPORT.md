# Graph Report - vitesakuga  (2026-08-13)

## Corpus Check
- 176 files · ~65,962 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1083 nodes · 1770 edges · 128 communities (49 shown, 79 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7adf65a1`
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
- @vitejs/plugin-react
- vitest
- wrangler
- drizzle.config.ts
- comments.service.ts
- index.tsx
- @effect/opentelemetry
- layer-factories.server.ts
- media-chrome
- @opentelemetry/sdk-logs
- @neondatabase/serverless
- @opentelemetry/sdk-trace-web
- @opentelemetry/semantic-conventions
- better-auth

## God Nodes (most connected - your core abstractions)
1. `scripts` - 32 edges
2. `compilerOptions` - 29 edges
3. `rules` - 22 edges
4. `useMutationWithFeedback()` - 21 edges
5. `FileRoutesByPath` - 17 edges
6. `parse()` - 14 edges
7. ``src/lib/`` - 14 edges
8. `plugins` - 12 edges
9. `DB` - 11 edges
10. `AGENT GUIDELINES FOR ViteSakuga` - 11 edges

## Surprising Connections (you probably didn't know these)
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `PostCardComponent()` --calls--> `assetUrl()`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/assets/url.ts
- `useUpdateProfile()` --calls--> `useMutationWithFeedback()`  [EXTRACTED]
  src/lib/auth/auth.hooks.ts → src/lib/mutations/mutation-feedback.ts
- `useChangePassword()` --calls--> `useMutationWithFeedback()`  [EXTRACTED]
  src/lib/auth/auth.hooks.ts → src/lib/mutations/mutation-feedback.ts
- `useDeleteAccount()` --calls--> `useMutationWithFeedback()`  [EXTRACTED]
  src/lib/auth/auth.hooks.ts → src/lib/mutations/mutation-feedback.ts

## Import Cycles
- None detected.

## Communities (128 total, 79 thin omitted)

### Community 0 - "posts.schema.ts"
Cohesion: 0.05
Nodes (50): Comments(), NotFound(), Pagination(), PaginationProps, PopularTag, PopularTagsSection(), PopularTagsSectionProps, Post() (+42 more)

### Community 1 - "test-utils.ts"
Cohesion: 0.19
Nodes (16): AuthService, AuthSessionProvider, RequestHeadersService, KyselyDB, LOG_LAYER, makeAuthLayer(), makeDBLayer(), makeMiddlewareLayer() (+8 more)

### Community 2 - "upload.lazy.tsx"
Cohesion: 0.15
Nodes (3): DB, PGliteConnection, PGliteDialect

### Community 3 - "playlists.service.ts"
Cohesion: 0.05
Nodes (58): getUserSession, AuthServices, getSessionEffect, getUserSessionEffect, SessionFetchError, SessionUser, CommentWithUser, SqlError (+50 more)

### Community 4 - "rules"
Cohesion: 0.10
Nodes (20): rules, @effect/dprint, @effect/no-import-from-barrel-package, jsx-a11y/media-has-caption, jsx-a11y/no-autofocus, max-statements, no-void, react-perf/jsx-no-new-function-as-prop (+12 more)

### Community 5 - "__root.tsx"
Cohesion: 0.07
Nodes (31): CommentsContent(), CommentsProps, GlobalShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, SHORTCUTS, ColorMode (+23 more)

### Community 6 - "posts.service.ts"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 7 - "sakuga.utils.ts"
Cohesion: 0.05
Nodes (41): account, session, user, userInsertSchema, userSelectSchema, verification, commentInsertSchema, comments (+33 more)

### Community 8 - "TypeScript & React Conventions"
Cohesion: 0.05
Nodes (34): Additional Resources, Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections (+26 more)

### Community 9 - "scripts"
Cohesion: 0.05
Nodes (42): devEngines, runtime, engines, node, name, private, name, onFail (+34 more)

### Community 10 - "compilerOptions"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 11 - "auth.hooks.ts"
Cohesion: 0.10
Nodes (28): FieldInfo(), PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, VisibilityTrigger, createWrapper() (+20 more)

### Community 12 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (25): AccountRoute, ApiAuthSplatRoute, authLoginRoute, authRouteRoute, authRouteRouteChildren, authRouteRouteWithChildren, authSignupRoute, ConvertRoute (+17 more)

### Community 13 - "AGENT GUIDELINES FOR ViteSakuga"
Cohesion: 0.08
Nodes (26): AGENT GUIDELINES FOR ViteSakuga, Agent skills, Async & Promises, Build, Lint, and Test Commands, Code Organization, Core Principles, Database Commands (Drizzle Kit), Detailed Guidelines (+18 more)

### Community 14 - "`src/lib/`"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 15 - "effect.utils.ts"
Cohesion: 0.19
Nodes (19): EFFECT_KYSELY_MARKER, EffectExecutor, EffectKysely, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw() (+11 more)

### Community 16 - "opencode.json"
Cohesion: 0.11
Nodes (18): path, description, repository, description, repository, lsp, mcp, signoz (+10 more)

### Community 17 - "-convert.machine.ts"
Cohesion: 0.17
Nodes (15): ActorLike, outputFormats, Route, RouteComponent(), clampVideoQuality(), ConvertDoneEvent, ConvertErrorEvent, convertMachine (+7 more)

### Community 18 - "dependencies"
Cohesion: 0.15
Nodes (13): alchemy, @aws-sdk/client-s3, isomorphic-dompurify, kysely, @opentelemetry/exporter-logs-otlp-http, @opentelemetry/sdk-trace-base, dependencies, alchemy (+5 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.11
Nodes (26): FormTextareaFieldProps, FormTextWrapper(), PlaylistAddModal(), PlaylistAddModalProps, PostEditForm(), PostEditFormProps, errorMessage(), MutationFeedbackOptions (+18 more)

### Community 20 - "Domain Glossary"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 21 - "router.tsx"
Cohesion: 0.17
Nodes (11): extends, jsPlugins, options, typeAware, typeCheck, $schema, @effect/eslint-plugin, ./node_modules/@effect/tsgo/oxlint-presets/correctness.json (+3 more)

### Community 22 - "global-setup.ts"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 23 - "devDependencies"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, devDependencies, @cloudflare/workers-types, tailwindcss, @tanstack/eslint-plugin-router, vite, tailwindcss, @tanstack/eslint-plugin-router (+1 more)

### Community 24 - "ViteSakuga"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Environments, Infrastructure Setup, Patches, Secondary (+1 more)

### Community 25 - "DB"
Cohesion: 0.17
Nodes (12): plugins, eslint, import, jsx-a11y, node, oxc, promise, react (+4 more)

### Community 26 - "knip.json"
Cohesion: 0.25
Nodes (7): entry, ignore, project, $schema, **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 27 - "index.tsx"
Cohesion: 0.17
Nodes (10): Route, Route, Route, Route, Route, Route, Route, Route (+2 more)

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
Nodes (51): SearchBox(), SearchBoxProps, TagInput(), TagInputProps, toaster, CommentDraft, queryClient, tagsCollection (+43 more)

### Community 37 - "PGliteDriver"
Cohesion: 0.33
Nodes (4): testUser, testUser2, PlaylistsService, PlaylistsServiceLive

### Community 38 - "better-auth"
Cohesion: 0.40
Nodes (5): func-style, typescript/consistent-type-definitions, declaration, error, type

### Community 41 - "@cloudflare/workers-types"
Cohesion: 0.67
Nodes (3): ignorePatterns, scripts/, *.test.*

### Community 44 - "drizzle-orm"
Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 46 - "users.service.ts"
Cohesion: 0.32
Nodes (6): tagsKeys, tagsQueries, tagsQueryGetPopularTags(), getAllPopularTags, Home(), Route

### Community 67 - "probe.ts"
Cohesion: 0.25
Nodes (7): a, b, c, d, PlaylistKeys, PlaylistPostsKeys, PostsKeys

### Community 121 - "comments.service.ts"
Cohesion: 0.50
Nodes (3): testUser, CommentsService, CommentsServiceLive

### Community 122 - "index.tsx"
Cohesion: 0.15
Nodes (13): AccountTable, CommentsTable, kysely, PlaylistPostsTable, PlaylistsTable, PostsTable, PostTagsTable, SessionTable (+5 more)

## Knowledge Gaps
- **492 isolated node(s):** `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json`, `eslint`, `typescript` (+487 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **79 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `media-chrome`, `@opentelemetry/sdk-logs`, `@neondatabase/serverless`, `@opentelemetry/sdk-trace-web`, `@opentelemetry/semantic-conventions`, `scripts`, `better-auth`, `@chakra-ui/react`, `@emotion/react`, `isomorphic-dompurify`, `users.index.tsx`, `@emotion/react`, `mediainfo.js`, `neonctl`, `next-themes`, `@opentelemetry/api`, `users.service.ts`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `useUploadForm.ts`, `@opentelemetry/sdk-trace-node`, `pg`, `postgres`, `react`, `react-dom`, `react-icons`, `@tailwindcss/vite`, `@tanstack/db`, `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-form`, `@tanstack/react-form-devtools`, `@tanstack/react-hotkeys`, `@tanstack/react-pacer`, `@tanstack/react-pacer-devtools`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@tanstack/react-router-ssr-query`, `@tanstack/react-start`, `xstate`, `@xstate/react`, `layer-factories.server.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@cloudflare/vite-plugin`, `dotenv`, `drizzle-seed`, `@effect/eslint-plugin`, `@effect/language-service`, `@effect/tsgo`, `@electric-sql/pglite`, `nitro`, `oxfmt`, `oxlint`, `kysely`, `@playwright/test`, `@tanstack/devtools-vite`, `@tanstack/eslint-plugin-query`, `@tanstack/eslint-plugin-router`, `@tanstack/react-devtools`, `taze`, `@testing-library/react`, `@types/bun`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `typescript`, `@vitejs/plugin-react`, `vitest`, `wrangler`, `@effect/opentelemetry`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `parse()` connect `playlists.service.ts` to `posts.schema.ts`, `route.tsx`, `auth.hooks.ts`, `sakuga.utils.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `./node_modules/@effect/tsgo/oxlint-presets/correctness.json`, `./node_modules/@effect/tsgo/oxlint-presets/effect-native.json` to the rest of the system?**
  _492 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `posts.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05403348554033485 - nodes in this community are weakly interconnected._
- **Should `playlists.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05201292976785189 - nodes in this community are weakly interconnected._
- **Should `rules` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._