# TypeScript & React Conventions

This document outlines the conventions and best practices for writing TypeScript and React code within the ViteSakuga project.

---

## JSX

- Use `react-jsx` (`jsx: "react-jsx"` in `tsconfig.json`).

## Component Structure

- Components are typically found in `src/components/`.

## Props

- Define props using TypeScript types.

## Hooks

- Use React Hooks idiomatically. Prefer custom hooks for reusable logic.

## Imports

- Absolute imports from the root using `src/` prefix (e.g., `import { foo } from "src/lib/utils"`) are supported via `paths: {"*": ["./*"]}` in `tsconfig.json` and `resolve.tsconfigPaths: true` in `vite.config.ts`.

## Naming Conventions

- **New files**: use `kebab-case` names, retaining established semantic suffixes such as `.service.ts`, `.schema.ts`, `.fn.test.ts`, and `.service.test.ts`. Existing React components use `PascalCase` filenames and some utilities use `camelCase`; keep those legacy names when editing in place instead of renaming unrelated files.
- **Components**: `PascalCase` (e.g., `UserProfile`, `Button`).
- **Variables/Functions**: `camelCase` (e.g., `getUserData`, `isLoading`).
- **Types/Interfaces**: `PascalCase` (e.g., `User`, `ApiResponse`).
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`).

## Styling

- Use Tailwind CSS v4 and Ark UI v5.

## Form Handling

- Use TanStack Form with Effect Schema for schema validation.

## Data Fetching

- **Loaders**: For critical, blocking data, usually co-located with `src/routes/` using `createFileRoute()`.
- **TanStack Query**: For non-blocking data, background refresh, and optimistic UI (e.g., `useSuspenseQuery()`).
