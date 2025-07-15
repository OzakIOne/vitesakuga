---
applyTo: "**"
---

# ViteSakuga Project Instructions

## Project Overview

ViteSakuga is a modern web application built with React and TypeScript, utilizing the TanStack suite of libraries for routing, data management, and form handling. The project follows a client-first, type-safe architecture with full-stack capabilities.

## Technology Stack

### Core Technologies

- **React**: UI library for building user interfaces
- **TypeScript**: Type-safe programming language
- **Vite**: Next-generation frontend build tooling

### Key Libraries

- **TanStack Router**: Type-safe routing solution
- **TanStack Query**: Data fetching and state management
- **TanStack Form**: Form handling and validation
- **TanStack Start**: Full-stack React framework integration

### Styling

- **TailwindCSS**: Utility-first CSS framework
- **DaisyUI**: Component library built on top of TailwindCSS
- **PostCSS**: CSS processing and transformations

### Database

- **PostgreSQL**: Primary database
- **Drizzle ORM**: Type-safe SQL toolkit
- **Kysely**: Type-safe SQL query builder

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

### Key Directories

#### `/components`

Contains reusable React components:

- `DefaultCatchBoundary.tsx`: Global error boundary component
- `NotFound.tsx`: 404 page component
- `PostError.tsx`: Post-specific error component
- `UserError.tsx`: User-specific error component

#### `/db`

Database configuration and schema:

- `db.ts`: Database connection setup
- `schema.ts`: Database schema definitions using Drizzle ORM
- `drizzle/`: Migration files and database snapshots

#### `/routes`

TanStack Router file-based routing:

- `__root.tsx`: Root layout and configuration
- API Routes:
  - `api/posts.ts`: Post-related API endpoints
  - `api/users.ts`: User-related API endpoints
- Page Routes:
  - `posts/`: Post-related pages
  - `users/`: User-related pages

#### `/utils`

Utility functions:

- `posts.tsx`: Post-related utilities
- `users.tsx`: User-related utilities
- `seo.ts`: SEO configuration
- `userSchemas.ts`: User validation schemas

## Development Patterns

### Routing

- Uses TanStack Router's file-based routing system
- Routes are defined in the `/routes` directory
- Each route file exports a `Route` component with its configuration
- API routes use `createServerFileRoute` for server-side handling

### Data Fetching

- Uses TanStack Query for data management
- Query definitions are centralized in utility files
- Implements optimistic updates for better UX
- Handles loading and error states consistently

### Form Handling

- Uses TanStack Form for form state management
- Implements Zod schemas for validation
- Provides immediate feedback on validation errors
- Handles form submission with loading states

### Error Handling

- Global error boundary with `DefaultCatchBoundary`
- Route-specific error components
- Typed error responses from API endpoints
- Consistent error message formatting

### Styling

- Uses Tailwind CSS for utility-first styling
- DaisyUI components for consistent UI elements
- Dark mode support with color scheme detection
- Responsive design patterns

## Database Management

### Schema Management

- Uses Drizzle ORM for type-safe schema definitions
- Migration management with drizzle-kit
- Explicit relationship definitions
- Strong typing for database operations

### Available Scripts

```bash
# Generate migrations
pnpm db:generate

# Push schema changes
pnpm db:push

# Apply migrations
pnpm db:migrate
```

## Development Workflow

### Getting Started

1. Install dependencies: `pnpm install`
2. Start the development server: `pnpm dev`
3. Build for production: `pnpm build`
4. Lint and format code: `pnpm biome`

### Code Standards

- Use TypeScript for type safety
- Follow React function component patterns
- Implement proper error handling
- Write descriptive component and function names
- Use TanStack Router patterns for routing
- Implement proper loading and error states

### Best Practices

1. Always use TypeScript for type safety
2. Implement proper error boundaries
3. Use TanStack Query for data fetching
4. Follow the file-based routing structure
5. Keep components focused and reusable
6. Implement proper form validation
7. Use proper loading and error states
8. Follow the established styling patterns

## API Structure

### Endpoints

- `/api/posts`: Post management
  - GET: Fetch all posts
  - POST: Create new post
- `/api/posts/$id`: Single post operations
  - GET: Fetch single post
- `/api/users`: User management
  - GET: Fetch all users
  - POST: Create new user
- `/api/users/$id`: Single user operations
  - GET: Fetch single user

### Response Format

All API endpoints return JSON responses with consistent error handling:

```typescript
// Success Response
{
  data: T; // Type depends on endpoint
}

// Error Response
{
  error: string;
}
```

## Deployment

The application is configured to run on port 3000 by default and can be deployed using standard Vite build procedures. Make sure to set up proper environment variables for database connections and any other configuration needed in your deployment environment.
