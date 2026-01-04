---
applyTo: "**"
---

# ViteSakuga Project Instructions

## Project Overview

ViteSakuga is a fullstack web app using TanStack Start, TanStack Router, Better Auth, Kysely, TanStack Form, Zod, and ChakraUI. The project follows a client-first, type-safe architecture with full-stack capabilities.

## Key Patterns & Conventions

### Core Technologies & Libraries

- **React**: UI library for building user interfaces
- **TypeScript**: Type-safe programming language
- **Vite**: Next-generation frontend build tooling
- **TanStack Router**: Type-safe routing solution
- **TanStack Query**: Data fetching and state management
- **TanStack Form**: Form handling and validation
- **TanStack Start**: Full-stack React framework integration
- **Better Auth**: Authentication solution
- **TailwindCSS**: Utility-first CSS framework
- **PostgreSQL**: Primary database
- **Drizzle ORM**: Type-safe SQL toolkit
- **Kysely**: Type-safe SQL query builder

### Authentication

- Uses **Better Auth**
- Server config in `src/auth/index.ts`

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

## Project Structure

### Source Directory Layout

```
src/
├── components/         # Reusable React components
├── db/                # Database schema and configuration
├── routes/            # Application routes and pages
├── styles/            # Global styles and theme configuration
└── utils/            # Utility functions and helpers
```

### Database

- PostgreSQL database with **Drizzle ORM** schemas and **Kysely** type-safe SQL query client.
- **Kysely** client used for type-safe SQL queries in `src/lib/db/kysely.ts`
- **Drizzle** Schemas used for kysely client in `src/lib/db/schemas/`
- Generate a migration file after every schema change: `pnpm db generate`
- Apply migrations with `pnpm db migrate` to test if they work correctly.

### Available Scripts

```bash
# Generate migrations
pnpm db generate

# Push schema changes
pnpm db push

# Apply migrations
pnpm db migrate
```

## File Structure Conventions

- `src/routes/` - Tanstack Router file-based router structure.
- `src/lib/posts/posts.fn.ts` - Server functions for posts feature.
- `src/lib/posts/posts.schema.ts` - Schemas for forms and server functions.

## When Adding Features

- **New routes**: Add to `src/routes/` with `createFileRoute()` pattern
- **Auth changes**: Modify `better-auth` config in `src/lib/auth` and update `src/routes/_app/route.tsx` beforeLoad for client.
- **Data fetching**: Use loaders for critical data, TanStack Query for non-blocking data
- **Styling**: Use ChakraUI and Tailwind CSS in `src/components/`
- **Database**: Use Kysely in `src/lib/db/kysely` for type-safe queries, and
- **Forms**: Use TanStack Form with Zod schemas

## Additional Resources
- **TanStack**: For comprehensive Tanstack guidance and best practices, see the official TanStack llms.txt file: https://tanstack.com/llms.txt every page has its markdown version just add .md to the url
- **ChakraUI**: For comprehensive ChakraUI guidance and best practices, see the official ChakraUI llms.txt file: https://chakra-ui.com/llms.txt
- **Drizzle**: For comprehensive Drizzle guidance and best practices, see the official Drizzle llms.txt file: https://orm.drizzle.team/llms.txt
- **Zod**: For comprehensive Zod guidance and best practices, see the official Zod llms.txt file: https://zod.dev/llms.txt
- **Kysely**: For comprehensive Kysely guidance and best practices, see the official Kysely llms.txt file: https://kysely.dev/llms.txt
- **Mediabunny**: For comprehensive Mediabunny guidance and best practices, see the official Mediabunny llms.txt file: https://mediabunny.dev/llms.txt
