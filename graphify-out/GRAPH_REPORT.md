# Graph Report - vitesakuga  (2026-07-17)

## Corpus Check
- 292 files · ~190,794 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3269 nodes · 3980 edges · 249 communities (172 shown, 77 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b7599b5e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- drizzle-seed
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 194
- Community 196
- Community 199
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

## God Nodes (most connected - your core abstractions)
1. `scripts` - 29 edges
2. `compilerOptions` - 29 edges
3. `rules` - 22 edges
4. `FileRoutesByPath` - 17 edges
5. `Anti-Patterns (Forbidden)` - 17 edges
6. `Angular Testing with Playwright` - 16 edges
7. `XState v5` - 15 edges
8. `Effect-TS Best Practices` - 14 edges
9. `Layer Patterns` - 14 edges
10. `Next.js Testing Patterns` - 14 edges

## Surprising Connections (you probably didn't know these)
- `candidate_xstate_roots()` --references--> `path`  [EXTRACTED]
  .agents/skills/xstate-v5/evals/extract_and_typecheck.py → opencode.json
- `PostCardComponent()` --calls--> `assetUrl()`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/assets/url.ts
- `getRouter()` --indirect_call--> `DefaultCatchBoundary()`  [INFERRED]
  src/router.tsx → src/components/DefaultCatchBoundary.tsx
- `makeAuthLayer()` --indirect_call--> `AuthService`  [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/auth/context.ts
- `makeMiddlewareLayer()` --indirect_call--> `AuthService`  [INFERRED]
  src/lib/db/layer-factories.server.ts → src/lib/auth/context.ts

## Import Cycles
- None detected.

## Communities (249 total, 77 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (13): alchemy, @aws-sdk/client-s3, drizzle-kit, effect, media-chrome, @opentelemetry/sdk-logs, dependencies, alchemy (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (33): Anti-Patterns, "browserType.launch: Executable doesn't exist", CI Container Jobs, Container-Based Testing, Custom Dockerfile, Decision Guide, Dev Container Setup, Docker Compose Stack (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (38): account, { createInsertSchema, createSelectSchema }, session, user, userInsertSchema, userSelectSchema, verification, commentInsertSchema (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (42): 1.1 Add Indexes on WHERE and JOIN Columns, 1.2 Choose the Right Index Type for Your Data, 1.3 Create Composite Indexes for Multi-Column Queries, 1.4 Use Covering Indexes to Avoid Table Lookups, 1.5 Use Partial Indexes for Filtered Queries, 1. Query Performance, 2.1 Configure Idle Connection Timeouts, 2.2 Set Appropriate Connection Limits (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (40): Accessing Results in Derived Atoms, Anti-Patterns, Atom Families, Atom.transform for Self-Updating Derived State, Atoms with Side Effects, Basic Atoms, Batching Updates, Core Concepts (+32 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (40): Authenticated Routes, Automatic (File-Based Routing), Best Practices, Code Splitting, Common Pitfalls, Context-Based Data Loading, Core Concepts, Data Loading (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (38): Advanced Patterns, Basic Usage, Basic Usage, Best Practices, Common Pitfalls, Core Concepts, Dependent Queries, Infinite Queries (+30 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (37): By Symptom, Capture Browser Console, CI-Specific Configuration, Common Issues, Compare Visual State, Custom Test Attachments, Debug CI Environment, Debug in Code (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (37): Anti-Patterns, API Routes, API Through UI, App Router Patterns, Auth Redirects, Auth Setup, Authenticated Tests, Catch-All Routes (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (9): oxlint-tsgolint, devDependencies, knip, oxlint-tsgolint, tailwindcss, @testing-library/jest-dom, knip, tailwindcss (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (34): Avoiding state leak in parallel runs, Basic Sharding, Benchmarking, Block Resource Types, Block Unnecessary Resources, Browser Contexts, Cache API Responses, CI Sharding Pattern (+26 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (34): Anti-Patterns to Avoid, Basic Mount, Component Testing, Configuration, Events & Interactions, Framework-Specific Patterns, Installation, Mocking API Calls (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (33): Annotation-Based Quarantine, Anti-Patterns to Avoid, Async/Timing Flakiness, Categories of Flakiness, CI-Specific Flakiness, Confirming Flakiness, Consistent Viewport and Scale, Data/Parallelism-Driven Flakiness (+25 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (32): Basic Workflow, Best Practices, Cache Node Modules, Cache Playwright Browsers, Caching, CI/CD Integration, CI Configuration Reference, CI-Specific Reporter (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (38): @cloudflare/workers-types, DOM, DOM.Iterable, ES2022, **/*.ts, **/*.tsx, vite/client, compilerOptions (+30 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (32): Access Electron APIs, Access Node.js in Renderer, Anti-Patterns to Avoid, Basic Configuration, BrowserWindow Properties, Clipboard, Context Isolation Testing, Development Mode (+24 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (48): ignorePatterns, jsPlugins, options, typeAware, typeCheck, plugins, rules, @effect/dprint (+40 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (30): Build-Time Diagnostics, CLI Tools, Code Generation, Common Diagnostics, Completions, Configuration Options, Diagnostics, Diagnostics Not Appearing (+22 more)

### Community 18 - "Community 18"
Cohesion: 0.06
Nodes (25): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary, Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket" (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (28): Bad agent brief, Behavioral, not procedural, Complete acceptance criteria, Durability over precision, Examples, Explicit scope boundaries, Good agent brief (bug), Good agent brief (enhancement) (+20 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (22): getSessionEffect, getUserSession, getUserSessionEffect, SessionFetchError, AuthService, AuthSessionProvider, RequestHeadersService, KyselyDB (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.05
Nodes (39): devEngines, runtime, engines, node, name, private, name, onFail (+31 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (29): Alarms and Timers, Anti-Patterns to Avoid, Background Script Testing, Basic Configuration, Browser Extension Testing, Content Script Communication, Content Script Testing, Context Menus (+21 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (37): auth, Route, Route, Route, Route, Route, Route, Route (+29 more)

### Community 24 - "Community 24"
Cohesion: 0.07
Nodes (29): Accept-Language Header, Anti-Patterns to Avoid, Checking for Missing Translations, Critical Element Screenshots, Date, Time & Number Formats, Detecting Text Overflow, Font Loading for i18n, Internationalization (i18n) Testing (+21 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (22): FieldInfo(), FormTextareaFieldProps, FormTextWrapper(), PostEditForm(), PostEditFormProps, toaster, postQueryDetail(), postsKeys (+14 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (17): DB, DrizzleSchema, kysely, KyselyDB, getKyselyPool(), getPool(), postsSelectSchema, EffectKysely (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (28): Add Annotations, Annotation Fixture, Annotation Helper, Anti-Patterns to Avoid, Basic Skip, Basic Steps, Conditional Annotations, Conditional Skip (+20 more)

### Community 28 - "Community 28"
Cohesion: 0.07
Nodes (28): Access Config in Global Setup, Anti-Patterns to Avoid, Basic Global Setup, Basic Global Teardown, Combining Both, Common Parallel Pitfall, Conditional Teardown, Configure Global Setup (+20 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (27): Accessing Cross-Origin Content, Accessing Nested Frames, Anti-Patterns to Avoid, Basic iFrame Access, Common Patterns, Cross-Origin iFrames, Debugging iFrame Issues, Dynamic iFrames (+19 more)

### Community 30 - "Community 30"
Cohesion: 0.07
Nodes (27): Anti-Patterns to Avoid, Background Sync, Cache Testing, Getting Service Worker State, Mocking Push Subscription, Offline Testing, Push Notifications, Registration & Lifecycle (+19 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (12): AGENT GUIDELINES FOR ViteSakuga, Build, Lint, and Test Commands, Database Commands (Drizzle Kit), Detailed Guidelines, General Code Style Principles, General Commands, graphify, Package Manager (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.07
Nodes (27): Anti-Patterns to Avoid, Auth Fixture, Authentication Patterns, Automatic Fixtures, Basic Custom Fixture, beforeAll / afterAll, beforeEach / afterEach, Built-in Fixtures (+19 more)

### Community 33 - "Community 33"
Cohesion: 0.07
Nodes (27): Advanced Patterns, Anti-Patterns to Avoid, Authentication Setup, Base Configuration, Basic Multi-Browser Setup, Chained Dependencies, Cleanup Setup, Conditional Projects (+19 more)

### Community 34 - "Community 34"
Cohesion: 0.07
Nodes (27): Anti-Patterns, Artifact Directory Structure, CI Artifact Upload, CLI Commands, Custom Reporter, Decision Guide, Empty HTML Report, Empty Merged Report (+19 more)

### Community 35 - "Community 35"
Cohesion: 0.07
Nodes (27): A11y as CI Gate, A11y Fixture, Accessibility Testing, Anti-Patterns to Avoid, ARIA States, ARIA Validation, Axe-Core Integration, Basic A11y Test (+19 more)

### Community 36 - "Community 36"
Cohesion: 0.07
Nodes (27): Anti-Patterns to Avoid, Canvas Basics, Canvas Screenshot Testing, Canvas & WebGL Testing, Chart.js Testing, Chart Libraries, Checking WebGL Support, Click on Canvas (+19 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (26): Anti-Patterns to Avoid, Basic Tagging, By Feature Area, By Priority, By Test Type, Combine Group and Test Tags, Common Tag Categories, Complex Patterns (+18 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (18): Pagination(), PaginationProps, PostCard, PostCardComponent(), PostListProps, UserErrorComponent(), DbSchemaSelect, PopularTag (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.08
Nodes (25): Anti-Patterns, API-Based Login, Authentication Testing, Decision Guide, Different browsers get different cookies, Global Setup Authentication, Global setup fails with "Target page, context or browser has been closed", Login Page Object (+17 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (25): Advance Time Manually, Always Install Clock Before Navigation, Anti-Patterns to Avoid, Best Practices, Clock API Basics, Clock with Fixture, Date, Time & Clock Mocking, Fixed Time Testing (+17 more)

### Community 41 - "Community 41"
Cohesion: 0.08
Nodes (25): Anti-Patterns to Avoid, Authentication Security, Authorization Testing, CSRF Protection, Input Validation, Monitor for XSS Execution, Related References, Security Headers (+17 more)

### Community 42 - "Community 42"
Cohesion: 0.16
Nodes (17): PasswordInput, PasswordInputProps, PasswordStrengthMeter, PasswordStrengthMeterProps, PasswordVisibilityProps, VisibilityTrigger, useChangePassword(), useDeleteAccount() (+9 more)

### Community 43 - "Community 43"
Cohesion: 0.08
Nodes (23): Anti-Patterns (Forbidden), Atoms with Side Effects, Basic Atoms, Build-Time Diagnostics, Effect Atom (Frontend State), Effect Language Server (Required), Effect-TS Best Practices, Error Definition Pattern (+15 more)

### Community 44 - "Community 44"
Cohesion: 0.08
Nodes (24): Anti-Patterns to Avoid, Bottom Sheet, Custom Device Configuration, Device Emulation, Dynamic Viewport Changes, Hamburger Menu, Long Press, Mobile & Responsive Testing (+16 more)

### Community 45 - "Community 45"
Cohesion: 0.08
Nodes (23): File Analysis: `src/` Directory, Form Components (`src/components/form/`), Main Components (`src/components/`), Post Detail Components (`src/components/PostDetail/`), Root Files (`src/`), `src/components/`, `src/db/`, `src/lib/` (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.08
Nodes (24): Advanced Network Interception, Anti-Patterns to Avoid, Conditional Mocking, GraphQL Mock Fixture, GraphQL Mocking, HAR Recording & Playback, HAR with Fallback, Mock Based on Request Body (+16 more)

### Community 47 - "Community 47"
Cohesion: 0.08
Nodes (24): Anti-Patterns to Avoid, Browser APIs: Geolocation, Permissions & More, Camera & Microphone, Clipboard, Clipboard Fixture, Geolocation, Geolocation Fixture, Grant Permissions (+16 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (23): Anti-Patterns to Avoid, Assertions & Waiting, Auto-Waiting (Default), Best Practices, Configure Timeouts, Custom Matchers, Generic Assertions, Locator Assertions (+15 more)

### Community 49 - "Community 49"
Cohesion: 0.08
Nodes (24): Anti-Patterns, Artifact Collection Strategy, baseURL Not Working, CLI Quick Reference, Decision Guide, Environment-Specific Configuration, Environment Variables with .env, globalSetup / globalTeardown (+16 more)

### Community 50 - "Community 50"
Cohesion: 0.08
Nodes (24): Anti-Patterns to Avoid, Error Boundaries, Error & Edge Case Testing, Form Validation, Go Offline During Session, Loading States, Network Failures, Offline Testing (+16 more)

### Community 51 - "Community 51"
Cohesion: 0.08
Nodes (24): Advanced Patterns, Anti-Patterns to Avoid, Basic Configuration, CI Integration, Collecting Coverage, Converting to Istanbul Format, Coverage for Specific Files, Coverage Reports (+16 more)

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (24): Authenticated Downloads, Capturing Downloads and Verifying Content, Checking Response Headers, Clearing Selection, Downloading Files, Drag-and-Drop Zones, Enforcing File Count Limits, Enforcing Size Limits (+16 more)

### Community 53 - "Community 53"
Cohesion: 0.08
Nodes (23): Array Fields, Array Methods, Asynchronous Validation, Best Practices, Common Pitfalls, Core: useForm, Field State, Fields (form.Field) (+15 more)

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (16): ColorMode, ColorModeButton, ColorModeButtonProps, ColorModeProvider(), ColorModeProviderProps, DarkMode, LightMode, useColorMode() (+8 more)

### Community 55 - "Community 55"
Cohesion: 0.09
Nodes (23): Anti-Patterns to Avoid, API Mocking Patterns, API Tests, Basic Visual Test, Best Practices, Component Tests, Configuration, Directory Structure (+15 more)

### Community 56 - "Community 56"
Cohesion: 0.09
Nodes (23): Anti-Patterns to Avoid, Basic Download, Basic Upload, Clear and Re-upload, Download Fixture, Download with Custom Path, Drag and Drop, Drag and Drop Upload (+15 more)

### Community 57 - "Community 57"
Cohesion: 0.09
Nodes (22): Animations cause random diff failures, Anti-Patterns, CI Configuration, Component Visual Testing, Configuring Thresholds, Cross-Browser Visual Testing, Decision Guide, Disabling Animations (+14 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (22): API Summary, Basic Query, Best Practices, Collections, Common Pitfalls, Core Concepts, Creating a Collection, Filter Operators (+14 more)

### Community 59 - "Community 59"
Cohesion: 0.09
Nodes (17): Deep Modules, Interface Design for Testability, Designing for Mockability, When to Mock, Refactor Candidates, 1. Planning, 2. Tracer Bullet, 3. Incremental Loop (+9 more)

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (20): testUser, testUser2, removePostFromPlaylistInputSchema, addPostToPlaylistEffect, createPlaylistEffect, deletePlaylistEffect, fetchPlaylistDetailEffect, fetchPlaylistsForPostEffect (+12 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (18): FileUploadData, FormFileUploadTextSchema, searchPostsBaseSchema, TagSchema, updatePostInputSchema, VideoMetadata, VideoMetadataSchema, analyzeVideo() (+10 more)

### Community 62 - "Community 62"
Cohesion: 0.09
Nodes (22): Anti-Patterns to Avoid, Capture Sent Messages, Collaborative Editing, Inject Messages via Page Evaluate, Live Data Updates, Live Notifications, Mock WebSocket with Route Handler, Mocking WebSocket Messages (+14 more)

### Community 63 - "Community 63"
Cohesion: 0.09
Nodes (20): Anti-Patterns to Avoid, Chaining, Common Issues & Solutions, Debugging Locators, Dynamic Content, Filtering & Chaining, getByLabel, getByPlaceholder (+12 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (22): Anti-Patterns to Avoid, Attach Console to Report, Auto-Fail Fixture, Basic Console Capture, Browser Console & JavaScript Error Handling, Capture by Type, Capture Deprecation Warnings, Capture Error Details (+14 more)

### Community 65 - "Community 65"
Cohesion: 0.10
Nodes (20): Basic Config, Basic Logging, Combining Observability, Config with Nested Structure, Config with Validation, Configuration with Config, Counter, Counter with Tags (+12 more)

### Community 66 - "Community 66"
Cohesion: 0.10
Nodes (21): Capturing Verification Tokens, Complete Reset Flow, Complex Authentication Flow Patterns, Detecting Expired Sessions, Email Verification Flows, Expired Token Handling, Fully Mocked Verification, Logout from All Devices (+13 more)

### Community 67 - "Community 67"
Cohesion: 0.10
Nodes (21): Anti-Patterns to Avoid, Basic Popup, Close All Tabs Except One, Different Users in Different Windows, Google OAuth Popup, Handle Blocked Popups, Intercept New Tab, Link Opens in New Tab (+13 more)

### Community 68 - "Community 68"
Cohesion: 0.10
Nodes (21): Anti-Patterns to Avoid, API-Based Seeding, Basic Factory, CSV/JSON Data Source, Data-Driven Testing, Database Seeding, Factory Pattern, Factory with Relationships (+13 more)

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (20): Anti-Patterns, Capturing Vue Warnings, Commands, Component Testing, Component Testing Dependencies, Component Testing with Experimental CT, Composition API Components, Configuration (+12 more)

### Community 70 - "Community 70"
Cohesion: 0.10
Nodes (21): Anti-Patterns to Avoid, Budget Fixture, CI Performance Monitoring, Core Web Vitals, Define Budgets, Lighthouse Integration, Lighthouse with Config, Measure LCP, FID, CLS (+13 more)

### Community 71 - "Community 71"
Cohesion: 0.14
Nodes (15): SearchBox(), SearchBoxProps, TagInput(), TagInputProps, CommentDraft, queryClient, tagsCollection, UploadDraft (+7 more)

### Community 72 - "Community 72"
Cohesion: 0.10
Nodes (19): Anti-Pattern: Generic Error Mapping, Basic Error Definition, catchTag for Single Error Types, catchTags for Multiple Error Types, Error Handling with catchTag/catchTags, Error Logging, Error Naming Conventions, Error Patterns (+11 more)

### Community 73 - "Community 73"
Cohesion: 0.10
Nodes (20): Analytics & Tracking, Anti-Patterns to Avoid, Block Analytics in Tests, Email Verification, Mock Analytics for Verification, Mock Email API, Mock Google OAuth, Mock PayPal (+12 more)

### Community 74 - "Community 74"
Cohesion: 0.10
Nodes (20): Anti-Patterns, Azure DevOps, Azure DevOps: Test results not showing, Basic Pipeline, Basic Pipeline, CI: CircleCI, Azure DevOps, and Jenkins, CircleCI, CircleCI: "Executable doesn't exist" (+12 more)

### Community 75 - "Community 75"
Cohesion: 0.10
Nodes (20): Anti-Patterns, Auto-Complete and Typeahead Fields, Date and Time Inputs, Date picker does not accept `fill()` value, Decision Guide, Dynamic Forms — Conditional Fields, `fill()` does nothing or clears but doesn't type, Filling Basic Form Fields (+12 more)

### Community 76 - "Community 76"
Cohesion: 0.10
Nodes (19): Async Variants, Batching, Best Practices, Choosing the Right Utility, Class API, Class API, Class API, Common Pitfalls (+11 more)

### Community 77 - "Community 77"
Cohesion: 0.10
Nodes (19): API Routes (Server Routes), Auth Middleware with Context, Basic Server Functions, Best Practices, Chaining Middleware, Common Pitfalls, Configuration (`app.config.ts`), Creating Middleware (+11 more)

### Community 78 - "Community 78"
Cohesion: 0.17
Nodes (14): Comments(), CommentsContent(), CommentsProps, CommentsFnsContext, defaultCommentsFns, useAddComment(), useDeleteComment(), commentsKeys (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.10
Nodes (3): PGliteConnection, PGliteDialect, PGliteDriver

### Community 80 - "Community 80"
Cohesion: 0.19
Nodes (18): EffectExecutor, EffectTransition, Executable, ExecutableRaw, execute(), executeRaw(), executeSpan(), executeTakeFirstOption() (+10 more)

### Community 81 - "Community 81"
Cohesion: 0.11
Nodes (19): Anti-Patterns to Avoid, Chat & Messaging, Collaborative Document, Concurrent Actions, Cursor Presence, Multi-User & Collaboration Testing, Multi-User Fixture, Multiple Browser Contexts (+11 more)

### Community 82 - "Community 82"
Cohesion: 0.11
Nodes (19): Angular Material Components, Angular Testing with Playwright, Anti-Patterns, Build Configurations, CDK Overlay Container, Configuration, Lazy-Loaded Modules, Locator Strategies (+11 more)

### Community 83 - "Community 83"
Cohesion: 0.12
Nodes (14): after, args, before, conditions, db, DB_PATH, extractText(), flagArgs (+6 more)

### Community 84 - "Community 84"
Cohesion: 0.11
Nodes (19): Anti-Patterns, Component Testing (Experimental), CRA vs Vite Differences, Detecting Memory Leaks, E2E Config (Vite), Error Boundaries, Form Libraries (React Hook Form, Formik), Framework Tips (+11 more)

### Community 85 - "Community 85"
Cohesion: 0.11
Nodes (19): Basic Workflow, Browser launch fails: "Missing dependencies", CLI Commands, Common Mistakes, Container-Based Execution, Environment Secrets, GitHub Actions for Playwright, No PR annotations (+11 more)

### Community 86 - "Community 86"
Cohesion: 0.09
Nodes (35): candidate_xstate_roots(), ensure_harness(), extract_blocks(), guess_filename(), harness_dir(), main(), make_case_dir(), parse_diagnostics() (+27 more)

### Community 87 - "Community 87"
Cohesion: 0.11
Nodes (18): Anti-Patterns, Basic Pipeline Configuration, Browser launch fails: "Failed to launch browser", Decision Guide, Environment Variables and Secrets, GitLab CI/CD Configuration, Key Commands, Merged report is empty after sharded run (+10 more)

### Community 88 - "Community 88"
Cohesion: 0.11
Nodes (19): "401 Unauthorized" when using `request` fixture, Anti-Patterns, API Data Seeding, API Testing, Chained API Calls, CRUD Operations, Decision Guide, Dedicated API Project Configuration (+11 more)

### Community 89 - "Community 89"
Cohesion: 0.15
Nodes (13): PopularTag, PopularTagsSection(), PopularTagsSectionProps, PostFilters(), PostFiltersProps, PostsPageLayoutProps, RegisteredRoutes, tagsKeys (+5 more)

### Community 90 - "Community 90"
Cohesion: 0.14
Nodes (10): Post(), PostDetailDisplay(), PostDetailDisplayProps, PostErrorComponent(), PostsPageLayout(), User(), Video, VideoProps (+2 more)

### Community 91 - "Community 91"
Cohesion: 0.13
Nodes (14): defaultVideoMetadata, testUser, postByTagSchema, fetchPostDetailEffect, getPostsByTag, getPostsByTagEffect, PostDetailResult, PostsSearchResult (+6 more)

### Community 92 - "Community 92"
Cohesion: 0.11
Nodes (17): Anti-Patterns (Forbidden), FORBIDDEN: any/unknown Casts, FORBIDDEN: catchAll Losing Type Information, FORBIDDEN: Config.secret (Deprecated), FORBIDDEN: console.log, FORBIDDEN: Context.Tag for Business Services, FORBIDDEN: Effect.runSync/runPromise Inside Services, FORBIDDEN: Ignoring Errors with orDie (+9 more)

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (18): Anti-Patterns, Blocking Unwanted Requests, Core Principle, Decision Flowchart, Decision Matrix, Environment-Based Test Projects, Full Mock (route.fulfill), Hybrid Approach: Fixture-Based Mock Control (+10 more)

### Community 94 - "Community 94"
Cohesion: 0.11
Nodes (17): Best Practices, Common Pitfalls, Core Pattern, Dynamic/Variable Heights, Grid Virtualization (Two Virtualizers), Horizontal Virtualization, Infinite Scrolling, Installation (+9 more)

### Community 95 - "Community 95"
Cohesion: 0.18
Nodes (12): ActorLike, outputFormats, Route, RouteComponent(), ConvertDoneEvent, ConvertErrorEvent, convertMachine, ConvertProgressEvent (+4 more)

### Community 96 - "Community 96"
Cohesion: 0.12
Nodes (16): Correct Pattern, Dependencies in Effect.Service, Infrastructure Layers, Layer Deduplication Benefits, Layer.effect vs Layer.succeed, Layer.mergeAll Over Nested Provides, Layer Naming Conventions, Layer Patterns (+8 more)

### Community 97 - "Community 97"
Cohesion: 0.12
Nodes (16): Branded Types for IDs, Branding Convention, Common Transforms, Creating Branded Values, Decoding and Encoding, Enums and Literals, Input Types for Mutations, Optional Fields (+8 more)

### Community 98 - "Community 98"
Cohesion: 0.12
Nodes (16): Annotating Spans, Basic Service Definition, Cloudflare Worker Bindings, Database/Redis Clients (Infrastructure), Effect.fn for Tracing, Effect.Service Over Context.Tag, Naming Convention, Return Types (+8 more)

### Community 99 - "Community 99"
Cohesion: 0.12
Nodes (17): Basic Structure, Best Practices, Component Objects, Composition Patterns, Directory Structure, Do, Don't, Factory Functions (+9 more)

### Community 100 - "Community 100"
Cohesion: 0.15
Nodes (9): PlaylistAddModal(), PlaylistAddModalProps, PlaylistsFnsContext, playlistsKeys, playlistsQueries, playlistsQueryForPost(), fetchPlaylistDetail, fetchPlaylistsForPost (+1 more)

### Community 101 - "Community 101"
Cohesion: 0.12
Nodes (15): Choose the tool, Final self-check, First pass, Migration, Modeling questions, Optional tools, Output format, Persistence (+7 more)

### Community 102 - "Community 102"
Cohesion: 0.13
Nodes (14): Activity Error Handling with Retryable, Activity Patterns, ClusterCron for Scheduled Jobs, Error Unions in RPC, From Backend Service, From HTTP Handler, Query vs Mutation, RPC & Cluster Patterns (+6 more)

### Community 103 - "Community 103"
Cohesion: 0.13
Nodes (15): Activity-Based Reference Guide, Advanced Patterns, Architecture Decisions, Debugging & Troubleshooting, Error & Edge Case Testing, Framework-Specific Testing, Infrastructure & Configuration, Mobile & Responsive Testing (+7 more)

### Community 104 - "Community 104"
Cohesion: 0.13
Nodes (14): Canvas Coordinate-Based Dragging, Cross-Frame Dragging, Custom Drag Preview, Drag and Drop Testing, File Drop Zone, Incremental Mouse Movement for Custom Libraries, Kanban Board (Cross-Column Movement), Keyboard-Based Reordering (+6 more)

### Community 105 - "Community 105"
Cohesion: 0.14
Nodes (14): Anti-Patterns, Combined Project Structure, Custom Fixtures, Helper Functions, Helpers with side effects, Locator-only page objects, Monolithic fixtures, Organizing Reusable Test Code (+6 more)

### Community 106 - "Community 106"
Cohesion: 0.14
Nodes (13): Advanced (`advanced/`), Architecture (`architecture/`), Browser APIs (`browser-apis/`), Core (`core/`), Debugging (`debugging/`), Frameworks (`frameworks/`), Infrastructure & CI/CD (`infrastructure-ci-cd/`), Installation (+5 more)

### Community 107 - "Community 107"
Cohesion: 0.14
Nodes (14): Anti-Patterns, Authenticated GraphQL Fixture, Authorization Errors, Basic Query with Variables, "Cannot query field X on type Y", GraphQL Helper Function, GraphQL returns 200 but data is null, GraphQL Testing (+6 more)

### Community 108 - "Community 108"
Cohesion: 0.15
Nodes (13): API Layer (60% of tests), API Tests, Choosing Test Types: E2E, Component, or API, Common Mistakes, Component Layer (30% of tests), Component Tests, Decision Matrix, E2E Layer (10% of tests) (+5 more)

### Community 109 - "Community 109"
Cohesion: 0.17
Nodes (11): Diagnose, Iterate on the loop itself, Non-deterministic bugs, Phase 1 — Build a feedback loop, Phase 2 — Reproduce, Phase 3 — Hypothesise, Phase 4 — Instrument, Phase 5 — Fix + regression test (+3 more)

### Community 110 - "Community 110"
Cohesion: 0.17
Nodes (11): Auth, Conventions, Core Entities, Domain Glossary, Infrastructure, Pagination, Post Detail, Search & Pagination (+3 more)

### Community 111 - "Community 111"
Cohesion: 0.17
Nodes (11): 1. Gather context, 2. Explore the codebase (optional), 3. Draft vertical slices, 4. Quiz the user, 5. Publish the issues to the issue tracker, Acceptance criteria, Blocked by, Parent (+3 more)

### Community 112 - "Community 112"
Cohesion: 0.17
Nodes (11): Actor creation, Core renames, Guard and action objects, Invocation, Parallel states: transition locality, Prefer `setup(...)`, Prefer v5 argument style, Preserve scope (+3 more)

### Community 113 - "Community 113"
Cohesion: 0.30
Nodes (8): NotFound(), assetUrl(), playlistQueryDetail(), playlistsQueryUserPlaylists(), PlaylistsContent(), Route, PlaylistDetailContent(), Route

### Community 114 - "Community 114"
Cohesion: 0.20
Nodes (10): Async & Promises, Code Organization, Core Principles, Error Handling & Debugging, Framework-Specific Guidance, Modern JavaScript/TypeScript, Performance, React & JSX (+2 more)

### Community 115 - "Community 115"
Cohesion: 0.29
Nodes (7): DefaultCatchBoundary(), getQueryClient(), getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 116 - "Community 116"
Cohesion: 0.20
Nodes (10): Component Structure, Data Fetching, Form Handling, Hooks, Imports, JSX, Naming Conventions, Props (+2 more)

### Community 117 - "Community 117"
Cohesion: 0.29
Nodes (8): testUser, addCommentEffect, CommentsService, CommentsServiceLive, CommentWithUser, deleteCommentEffect, fetchCommentsEffect, commentsSelectSchema

### Community 118 - "Community 118"
Cohesion: 0.22
Nodes (6): CONTEXT.md Format, Rules, Single vs multi-context repos, Structure, Domain awareness, File structure

### Community 119 - "Community 119"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Process, Solution, Testing Decisions, User Stories

### Community 120 - "Community 120"
Cohesion: 0.22
Nodes (8): Description Requirements, Process, Review Checklist, SKILL.md Template, Skill Structure, When to Add Scripts, When to Split Files, Writing Skills

### Community 121 - "Community 121"
Cohesion: 0.22
Nodes (8): After, Before, Machine with `setup(...)`, Migration notes example, Prefer `@xstate/store` for simple domains, Shared actor with React, Shared async auth actor with React, XState v5 Examples

### Community 122 - "Community 122"
Cohesion: 0.25
Nodes (8): Auth Middleware, `createHandler` Bridge, Effective Service Files, Error Handling, Location, Server Functions & API Design, Structure of a Service File, Validation

### Community 123 - "Community 123"
Cohesion: 0.25
Nodes (7): CommandError, createBucket, curlStatus(), exec(), setup, startRustFS, waitForHealth

### Community 124 - "Community 124"
Cohesion: 0.22
Nodes (8): CommentNotFoundError, ForbiddenError, PlaylistNotFoundError, PostAlreadyInPlaylistError, PostNotFoundError, UnauthorizedError, UserNotFoundError, ValidationError

### Community 125 - "Community 125"
Cohesion: 0.22
Nodes (8): 1. Prerequisites, 2. Deploy the Bucket, 3. Sync to Environment, Dev, Infrastructure Setup, Patches, Secondary, ViteSakuga

### Community 126 - "Community 126"
Cohesion: 0.50
Nodes (5): StorageError, StorageModule, makeRustFSStorageLayer(), StorageLive, runTest()

### Community 127 - "Community 127"
Cohesion: 0.25
Nodes (8): 1. In-process, 2. Local-substitutable, 3. Remote but owned (Ports & Adapters), 4. True external (Mock), Deepening, Dependency categories, Seam discipline, Testing strategy: replace, don't layer

### Community 128 - "Community 128"
Cohesion: 0.25
Nodes (7): Advanced XState v5 Patterns, Avoid over-modeling the parent machine, Choosing the right actor kind, Emitted events, Persistence and hydration, Prefer event payloads over context relay, Typed actions beyond `assign(...)`

### Community 129 - "Community 129"
Cohesion: 0.29
Nodes (5): GlobalShortcuts(), KeyboardShortcutsDialog(), KeyboardShortcutsDialogProps, Shortcut, SHORTCUTS

### Community 130 - "Community 130"
Cohesion: 0.25
Nodes (7): defaultPlaylistsFns, addPostToPlaylist, createPlaylist, deletePlaylist, removePostFromPlaylist, reorderPlaylistPosts, updatePlaylist

### Community 131 - "Community 131"
Cohesion: 0.29
Nodes (7): Database Conventions (Drizzle ORM & Kysely), Drizzle Schemas, Effect Layer Pattern, Kysely Client, Location, Migrations, TanStack DB Collections

### Community 132 - "Community 132"
Cohesion: 0.29
Nodes (7): Challenge against the glossary, Cross-reference with code, Discuss concrete scenarios, During the session, Offer ADRs sparingly, Sharpen fuzzy language, Update CONTEXT.md inline

### Community 133 - "Community 133"
Cohesion: 0.29
Nodes (7): Candidate card, Header, HTML Report Format, Scaffold, Style guidance, Tone, Top recommendation section

### Community 134 - "Community 134"
Cohesion: 0.29
Nodes (6): Adapter Notes, Heuristic, React, Solid, Svelte, Vue

### Community 135 - "Community 135"
Cohesion: 0.33
Nodes (5): usersKeys, usersQueries, FetchUserInput, fetchUserInputSchema, fetchUserPosts

### Community 136 - "Community 136"
Cohesion: 0.29
Nodes (6): Authentication, Database, File Structure Conventions, Project Structure & File Conventions, Source Directory Layout, Upload & Storage

### Community 137 - "Community 137"
Cohesion: 0.50
Nodes (4): Form Handling, Key Patterns & Conventions, Routing & Data fetching, Server Functions

### Community 138 - "Community 138"
Cohesion: 0.33
Nodes (6): ADR Format, Numbering, Optional sections, Template, What qualifies, When to offer an ADR

### Community 139 - "Community 139"
Cohesion: 0.33
Nodes (6): Call-graph collapse, Cross-section (good for layered shallowness), Diagram patterns, Hand-built boxes-and-arrows (when Mermaid's layout fights you), Mass diagram (good for "interface as wide as implementation"), Mermaid graph (the workhorse for dependencies / call flow)

### Community 140 - "Community 140"
Cohesion: 0.33
Nodes (6): 1. Explore, 2. Present candidates as an HTML report, 3. Grilling loop, Glossary, Improve Codebase Architecture, Process

### Community 141 - "Community 141"
Cohesion: 0.33
Nodes (6): CommandError, curlStatus(), ensureRustFS, exec(), isRunning, waitForHealth

### Community 142 - "Community 142"
Cohesion: 0.33
Nodes (5): Browser inspector, Inspection API, Observable actors, Observables And Inspection, Rule of thumb

### Community 143 - "Community 143"
Cohesion: 0.53
Nodes (5): expectation_credit(), expectation_weight(), main(), Path, regrade_file()

### Community 144 - "Community 144"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 145 - "Community 145"
Cohesion: 0.60
Nodes (4): loginSchema, passwordSchema, profileSchema, signUpSchema

### Community 146 - "Community 146"
Cohesion: 0.33
Nodes (5): addPostToPlaylistInputSchema, createPlaylistInputSchema, fetchPlaylistDetailSchema, reorderPlaylistPostsInputSchema, updatePlaylistInputSchema

### Community 147 - "Community 147"
Cohesion: 0.40
Nodes (4): Auto-Clarity Exception, Examples, Persistence, Rules

### Community 149 - "Community 149"
Cohesion: 0.25
Nodes (7): entry, ignore, project, $schema, **/*.d.ts, src/**/*.{js,ts,tsx}, src/router.tsx

### Community 150 - "Community 150"
Cohesion: 0.40
Nodes (5): 1. Frame the problem space, 2. Spawn sub-agents, 3. Present and compare, Interface Design, Process

### Community 151 - "Community 151"
Cohesion: 0.40
Nodes (5): Language, Principles, Rejected framings, Relationships, Terms

### Community 152 - "Community 152"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 153 - "Community 153"
Cohesion: 0.40
Nodes (4): Conventions, Issue tracker: GitHub, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 154 - "Community 154"
Cohesion: 0.50
Nodes (4): Agent skills, Domain docs, Issue tracker, Triage labels

### Community 155 - "Community 155"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 156 - "Community 156"
Cohesion: 0.50
Nodes (3): computePagination(), PaginationInput, PaginationMeta

### Community 164 - "Community 164"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, ViteTypeOptions

### Community 167 - "Community 167"
Cohesion: 0.23
Nodes (5): Additional Resources, Feature Implementation Guidelines, When Adding Features, Detailed Guidelines, Package Manager

## Knowledge Gaps
- **2075 isolated node(s):** `$schema`, `eslint`, `typescript`, `unicorn`, `oxc` (+2070 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Browser APIs: Geolocation, Permissions & More` connect `Community 47` to `Community 1`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Component Testing` connect `Community 11` to `Community 1`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Browser Extension Testing` connect `Community 22` to `Community 1`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `$schema`, `eslint`, `typescript` to the rest of the system?**
  _2075 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05616509926854754 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05708245243128964 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._