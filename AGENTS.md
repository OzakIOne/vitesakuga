# AGENTS.md

## Project overview
- **Description**: ViteSakuga is a sakugabooru-style video hosting and tagging platform (MVP) built with modern TypeScript tools.
- **Architecture**: Monolithic full-stack application using TanStack Start (SSR) and React.
- **Constraints**:
  - Uses **Cloudflare R2** for video/image storage.
  - Uses **Neon (PostgreSQL)** for the database.
  - Infrastructure is managed via **Pulumi**.

## Tech stack and dependencies
- **Languages**: TypeScript (Strict mode).
- **Frameworks**: React 19, TanStack Start, Tailwind CSS v4, Chakra UI v3.
- **Core Libraries**:
  - **Routing/State**: `@tanstack/react-router`, `@tanstack/react-query`.
  - **Data**: `drizzle-orm` (ORM), `kysely` (Query Builder), `zod` (Validation), `better-auth` (Authentication).
  - **Forms**: `@tanstack/react-form`.
  - **Media**: `mediabunny`, `media-chrome`, `mediainfo.js`.
- **Tools**: `vite` (Build), `pnpm` (Manager), `biome` (Lint/Format), `oxlint` (Lint).

## Project structure
- **`src/`**: Application source code.
  - **`routes/`**: File-based routing (pages and API endpoints). Main entry points.
  - **`components/`**: Reusable UI components.
  - **`lib/`**: Shared libraries, including DB schema (`db/schema`) and env validation.
  - **`utils/`**: Helper functions.
  - **`router.tsx`**: Router configuration and entry.
- **`drizzle/`**: SQL migrations and Drizzle Kit output.
- **`infra/`**: Pulumi infrastructure code for Cloudflare R2/S3.
- **`public/`**: Static assets.

## Development commands
- **Install dependencies**: `pnpm i`
- **Run dev server**: `pnpm dev`
- **Build project**: `pnpm run build`
- **Lint code**: `pnpm run biome check`
- **Format code**: `pnpm run biome format`
- **Database Tools**: `pnpm run db` (runs `drizzle-kit` for generating/pushing migrations)
- **Infrastructure**: `pnpm run dcu` (Docker Compose Up for local services)

## Code style and patterns
- **Preferred Patterns**:
  - **Functional Components**: Use React functional components with Hooks.
  - **Data Fetching**:
    - Use **Router Loaders** for critical data (blocking, required for first paint).
    - Use **TanStack Query** for non-blocking data (streaming, background refresh, non-critical UI).
    - Preference for `useSuspenseQuery` with `loader` prefetching via `queryClient.ensureQueryData`.
  - **Forms**: Use `@tanstack/react-form` with Zod validators.
  - **Styling**: Use Tailwind CSS utility classes and Chakra UI components.
  - **Database**: Use Kysely for type-safe query building and Drizzle for schema definitions.
- **Disallowed Patterns**:
  - No class-based React components.
  - No inline SQL strings (always use Drizzle).
  - No direct DOM manipulation (use Refs).
- **Formatting**: Enforced by `biome`. Run `pnpm run biome format` before committing.

## Testing guidelines
- **Status**: No formal test suite is currently implemented.
- **Recommendation**: If instructed to add tests, use **Vitest** given the Vite ecosystem.
- **Expectations**:
  - **Adding tests**: Focus on utility functions in `src/utils` and complex logic in `src/lib`.
  - **Running tests**: (Future) `vitest run`.

## Safety, permissions, and limitations
- **Allowed (No Approval Needed)**:
  - Editing files in `src/`.
  - Running lint/format commands.
  - Reading `infra/` or `drizzle/` for context.
- **Requires Approval**:
  - Installing new `npm` packages.
  - Running `drizzle-kit` commands that modify the database schema.
  - Running `pulumi` commands or modifying `infra/`.
  - Creating new migrations.
- **Forbidden**:
  - Committing secrets or `.env` files.
  - Modifying `pnpm-lock.yaml` manually (use `pnpm`).
  - Hardcoding credentials in code.

## Common workflows
- **Adding a new feature**:
  1. Create new route in `src/routes/` (e.g., `src/routes/new-feature.tsx`).
  2. Create associated components in `src/components/`.
  3. Define data requirements in the route `loader`.
- **Modifying Database Schema**:
  1. Edit `src/lib/db/schema/index.ts` (or specific schema file).
  2. Ask user to run `pnpm run db generate` to create migration.
- **Adding an API Endpoint**:
  1. Create a file in `src/routes/api/` (e.g., `src/routes/api/hello.ts`).
  2. Export a loader or action function.

## API and data contracts
- **Data Models**: Defined in `src/lib/db/schema/`. Uses Drizzle ORM with Zod schemas.
- **API**: TanStack Start server functions/API routes located in `src/routes/api`.
- **Validation**: Strict Zod validation required for all user inputs and API payloads.

## Performance and security notes
- **Performance**:
  - Large lists must use virtualization (`@tanstack/react-virtual`).
  - Media assets are served via Cloudflare R2 (ensure correct URLs).
- **Security**:
  - Auth is handled by `better-auth`. Do not roll custom auth logic.
  - Validate all env vars in `src/lib/env/server.ts`.

## Examples of good and bad code
- **Good (Data Fetching)**:
  ```tsx
  // 1. Critical Data (Blocking)
  // src/routes/posts.$id.tsx
  export const Route = createFileRoute('/posts/$id')({
    loader: ({ context, params }) =>
      context.queryClient.ensureQueryData(postQueryOptions(params.id)),
    component: PostComponent
  })

  // 2. Non-blocking Data (Streaming/Background)
  // Inside a component
  const { data } = useQuery(relatedPostsQueryOptions(postId))
  ```
  *Why: Loaders ensure critical data is available for SSR. TanStack Query handles non-critical, secondary data without blocking the initial render.*

- **Good (Database)**:
  ```ts
  // src/lib/db/queries.ts
  await db.select().from(posts).where(eq(posts.id, postId));
  ```
  *Why: Type-safe Drizzle query.*

- **Bad (Inline Styles)**:
  ```tsx
  <div style={{ marginTop: '10px', color: 'red' }}>Error</div>
  ```
  *Why: Use Tailwind classes (`mt-2 text-red-500`) for consistency.*

- **Bad (Direct Fetch)**:
  ```tsx
  useEffect(() => { fetch('/api/posts').then(...) }, [])
  ```
  *Why: Causes waterfalls; use TanStack Query.*

## Pull request checklist
- [ ] `pnpm run lint` passes (no oxlint errors).
- [ ] `pnpm run format` has been run.
- [ ] No type errors (`tsc` or editor check).
- [ ] New environment variables (if any) are added to validation schema.
- [ ] Diffs are focused and atomic.

## When unsure
- **Ambiguity**: Ask clarifying questions if requirements for a feature (e.g., "add comments") are vague regarding UI or DB storage.
- **Risky Changes**: If modifying `infra/` or core database schemas, propose a plan first.
- **Defaults**: Stick to existing patterns in `src/routes` and `src/components`.
