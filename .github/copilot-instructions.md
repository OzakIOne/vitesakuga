---
applyTo: "**"
---

## Key Patterns & Conventions

### Server Functions

- Server functions only use backend code (database, bucket, auth) and return serializable data.
- Use server functions in `src/lib/<feature>/<feature>.fn.ts` to interact with database.
- Server functions can be called from loaders, queryOptions (Tanstack Query), components (with `useServerFn`) and other server-functions.
- Compose server function into other server functions to make logical units.
- Server functions should be validated with Zod schemas in `src/lib/<feature>/<feature>.schema.ts`.
- Server functions should use typesafe middlewares for auth, roles, etc.
- Server functions should just throw errors and avoid try-catch when possible. The caller should handle errors.

### Routing & Data fetching

- **TanStack Router** with file-based routing in `src/routes/`
- Routes use `createFileRoute()` pattern with co-located loaders
- Routes Loaders are SSR friendly way to fetch critical datas: The route cannot render without the data (critical, blocking data).

- Loaders can navigation gating: redirect/notFound from the data result.
- Loaders can validate URL search params (`validateSearch`) and bind them to caching (`loaderDeps`)
- Loaders can seed TanStack Query before render: loader calls `queryClient.ensureQueryData(...)` and the component uses useSuspenseQuery for streaming.

- **Tanstack Query** is used for data that doesn't need to be in the HTML on first paint. Perfect for showing skeletons, optimistic UI, background refresh, and data streaming with `useSuspenseQuery()`.
- Tanstack Query is also used when data should refresh independently of navigation (polling/live updates).
- Tanstack Query avoid the router to gate render.

### Form Handling

- Uses TanStack Form for form state management
- Implements Zod schemas for validation
- Provides immediate feedback on validation errors
- Handles form submission with loading states

## Detailed Guidelines

For more specific guidelines, refer to the following documents:

*   [TypeScript & React Conventions](../docs/typescript-react-conventions.md)
*   [Server Functions & API Design](../docs/server-functions-api.md)
*   [Database Conventions (Drizzle ORM & Kysely)](../docs/database-conventions.md)
*   [Project Structure & File Conventions](../docs/project-structure.md)
*   [Feature Implementation Guidelines](../docs/feature-implementation-guidelines.md)
*   [Additional Resources](../docs/additional-resources.md)
