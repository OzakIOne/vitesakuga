# Project Structure & File Conventions

This document details the expected project structure and file conventions within the ViteSakuga project.

---

## Source Directory Layout

```
src/
├── components/ # Reusable React components
├── db/         # Database schema and configuration
├── routes/     # Application routes and pages
├── styles/     # Global styles and theme configuration
└── utils/      # Utility functions and helpers
```

## File Structure Conventions

*   `src/routes/` - Tanstack Router file-based router structure.
*   `src/lib/posts/posts.fn.ts` - Server functions for posts feature.
*   `src/lib/posts/posts.schema.ts` - Schemas for forms and server functions.

## Authentication
*   Server config in `src/lib/auth/index.ts`.
