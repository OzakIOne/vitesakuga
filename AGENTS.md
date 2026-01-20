# AGENT GUIDELINES FOR ViteSakuga

ViteSakuga is a fullstack web application built with React 19, TanStack Start, TanStack Router, Better Auth, Kysely, Drizzle ORM, TanStack Form, Zod, Tailwind CSS v4, and Chakra UI v3, emphasizing a client-first, type-safe architecture with full-stack capabilities.

---

## Package Manager

All commands are executed using `pnpm`.

## Build, Lint, and Test Commands

### General Commands
*   **Install Dependencies**: `pnpm install`
*   **Development Server**: `pnpm dev` (starts `vite dev` on port 3000)
*   **Production Build**: `pnpm build` (runs `vite build`)
*   **Start Production Server**: `pnpm start` (runs `node run .output/server/index.mjs`)
*   **Preview Production Build**: `pnpm server` (runs `vite preview`)

### Linting and Formatting
*   **Biome Check**: `pnpm biome` (runs `biome check --write`)

### Testing
The project uses `vitest` for testing.
*   **Run Tests (watch mode)**: `pnpm test` (runs `vitest -w`)
*   **Run All Tests (single pass)**: `vitest`
*   **Run a Single Test File**: `vitest <path/to/test-file.test.ts>`
*   **Run a Specific Test by Name**: `vitest -t "Test suite name" -t "specific test name"`

### Database Commands (Drizzle Kit)
*   **Generate Migrations**: `pnpm db generate` (runs `drizzle-kit generate:pg`)
*   **Push Schema Changes**: `pnpm db push` (runs `drizzle-kit push:pg`)
*   **Apply Migrations**: `pnpm db migrate` (runs `drizzle-kit migrate`)

## General Code Style Principles

*   **Type Safety**: Prioritize strong typing.
*   **Consistency**: Adhere to existing patterns and conventions within the codebase.
*   **Functional Programming**: Favor pure functions and immutability where appropriate.
*   **Error Handling**: Server functions should generally throw errors, allowing callers to handle them. Use `try-catch` blocks sparingly in server functions.

---

## Detailed Guidelines

For more specific guidelines, refer to the following documents:

*   [TypeScript & React Conventions](./docs/typescript-react-conventions.md)
*   [Server Functions & API Design](./docs/server-functions-api.md)
*   [Database Conventions (Drizzle ORM & Kysely)](./docs/database-conventions.md)
*   [Project Structure & File Conventions](./docs/project-structure.md)
*   [Feature Implementation Guidelines](./docs/feature-implementation-guidelines.md)
*   [Additional Resources](./docs/additional-resources.md)

## Copilot Instructions

The original Copilot instructions from `.github/copilot-instructions.md` are also a valuable reference and should be adhered to for additional context and guidance not explicitly covered here.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
