# Database Conventions (Drizzle ORM & Kysely)

This document outlines the conventions and best practices for database interactions within the ViteSakuga project, utilizing Drizzle ORM and Kysely.

---

## Location
*   Database schemas and configuration in `src/db/`.

## Kysely Client
*   Type-safe SQL queries via `src/lib/db/kysely.ts`.

## Drizzle Schemas
*   Used for Kysely client, located in `src/lib/db/schemas/`.

## Migrations
*   Follow Drizzle Kit migration workflow (`pnpm db generate`, `pnpm db push`, `pnpm db migrate`).
