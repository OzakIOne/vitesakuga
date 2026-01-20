# Server Functions & API Design

This document outlines the conventions and best practices for developing server functions and API design within the ViteSakuga project.

---

## Location
*   `src/lib/<feature>/<feature>.fn.ts`.

## Purpose
*   Backend code only, returning serializable data.

## Composition
*   Can be composed from other server functions.

## Validation
*   Must be validated with Zod schemas located at `src/lib/<feature>/<feature>.schema.ts`.

## Middlewares
*   Use type-safe middlewares for authentication, roles, etc.

## Error Handling
*   Throw errors; avoid `try-catch` within server functions themselves. Let the caller handle errors.
