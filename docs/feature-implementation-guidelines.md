# Feature Implementation Guidelines

This document provides guidelines for implementing new features within the ViteSakuga project.

---

## When Adding Features

*   **New routes**: Add to `src/routes/` with `createFileRoute()` pattern.
*   **Auth changes**: Modify `better-auth` config in `src/lib/auth` and update `src/routes/_app/route.tsx` beforeLoad for client.
*   **Data fetching**: Use loaders for critical data, TanStack Query for non-blocking data.
*   **Styling**: Use ChakraUI and Tailwind CSS in `src/components/`.
*   **Database**: Use Kysely in `src/lib/db/kysely` for type-safe queries.
*   **Forms**: Use TanStack Form with Zod schemas.
