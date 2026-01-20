# TypeScript & React Conventions

This document outlines the conventions and best practices for writing TypeScript and React code within the ViteSakuga project.

---

## JSX
*   Use `react-jsx` (`jsx: "react-jsx"` in `tsconfig.json`).

## Component Structure
*   Components are typically found in `src/components/`.

## Props
*   Define props using TypeScript types.

## Hooks
*   Use React Hooks idiomatically. Prefer custom hooks for reusable logic.

## Imports
*   Absolute imports from the root (e.g., `import { foo } from "lib/utils";`) are supported via `paths: {"*": ["./*"]}` and `vite-tsconfig-paths`.

## Naming Conventions
*   **Files**: `PascalCase` for React components (e.g., `MyComponent.tsx`), `camelCase` for utility files (e.g., `utils.ts`), `kebab-case` for CSS files, `feature.fn.ts` for server functions, `feature.schema.ts` for Zod schemas.
*   **Components**: `PascalCase` (e.g., `UserProfile`, `Button`).
*   **Variables/Functions**: `camelCase` (e.g., `getUserData`, `isLoading`).
*   **Types/Interfaces**: `PascalCase` (e.g., `User`, `ApiResponse`).
*   **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`).

## Styling
*   Use Tailwind CSS v4 and Chakra UI v3.

## Form Handling
*   Use TanStack Form with Zod for schema validation.

## Data Fetching
*   **Loaders**: For critical, blocking data, usually co-located with `src/routes/` using `createFileRoute()`.
*   **TanStack Query**: For non-blocking data, background refresh, and optimistic UI (e.g., `useSuspenseQuery()`).
