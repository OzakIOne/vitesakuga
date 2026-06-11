# Feature Implementation Guidelines

This document provides guidelines for implementing new features within the ViteSakuga project.

---

## When Adding Features

- **New routes**: Add to `src/routes/` with `createFileRoute()` pattern. Route group directories use parentheses (e.g., `(auth)/`).
- **Auth changes**: Modify Better Auth config in `src/lib/auth/index.ts`. Update `src/routes/__root.tsx` `beforeLoad` for session fetching. Use `makeAuthLayer` in `createHandler` for protected server functions.
- **Data fetching**: Use `beforeLoad` for critical session data, TanStack Query `queryOptions` factories (in `*.queries.ts`) for non-blocking data. TanStack DB collections (in `src/lib/db/collections.ts`) for reactive client-side stores.
- **Styling**: Use Chakra UI v3 and Tailwind CSS v4 in `src/components/`.
- **Database**: Define Drizzle schema tables in `src/lib/db/schema/`. Use Kysely queries through the `KyselyDB` Effect context tag (never import raw Kysely directly in services).
- **New service**: Create `<feature>.service.ts` in `src/lib/<feature>/` following the Effect service pattern: `Context.Service` → `Layer.effect` → `Effect.fn` wrappers → `createServerFn` exports.
- **Forms**: Use TanStack Form with Zod schemas from `src/lib/<feature>/<feature>.schema.ts`.
- **Server functions**: Embed in `*.service.ts` files using `createServerFn().validator(...).handler(createHandler(...))`.
