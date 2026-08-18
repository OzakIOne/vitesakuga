# Server Functions & API Design

This document outlines the conventions and best practices for developing server functions and API design within the ViteSakuga project.

---

## Location

Server functions are embedded within Effect service files in `src/lib/<feature>/<feature>.service.ts`.

The old pattern of separate `<feature>.fn.ts` files has been consolidated — server functions (`createServerFn`) are now co-located with their Effect service definitions at the bottom of each `*.service.ts` file.

## Structure of a Service File

Each `*.service.ts` file follows this layered pattern (top to bottom):

1. **Imports** — Effect, TanStack Start, domain schemas (Effect Schema), layer factories, `createHandler`
2. **Service class** — Effect `Context.Service<Self, Shape>()("Name", { make })` with the typed interface as `Shape` and the implementation as `make`
3. **Static accessors** — `Effect.fn` static methods on the service class (e.g., `CommentsService.fetch`) that pull the service from the context
4. **Live layer** — `Layer.effect(Service, Service.make)` providing the service
5. **Server functions** — TanStack Start `createServerFn` instances with Effect Schema validators calling `createHandler`

Example pattern (from `comments.service.ts`):

```typescript
// 2. Service class + 3. static accessors
export class CommentsService extends Context.Service<CommentsService, {
  readonly fetch: (postId: number) => Effect.Effect<unknown, Error>;
  readonly add: (data: ...) => Effect.Effect<unknown, Error>;
  readonly delete_: (commentId: number) => Effect.Effect<{ success: boolean }, Error, AuthServices>;
}>()("CommentsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    // ... implementation
    return { fetch, add, delete_ };
  }),
}) {
  static readonly fetch = Effect.fn("CommentsService.fetch")(function* (postId: number) {
    const svc = yield* CommentsService;
    return yield* svc.fetch(postId);
  });
  // ... other static accessors
}

// 4. Live layer
export const CommentsServiceLive = Layer.effect(CommentsService, CommentsService.make);

// 5. Server functions
export const fetchComments = createServerFn()
  .validator((input: unknown) => parse(Schema.Number)(input))
  .handler(createHandler(CommentsService.fetch, CommentsServiceLive));

export const addComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(commentInsertSchema)(input))
  .handler(createHandler(addCommentEffect, CommentsServiceLive));

export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(Schema.Struct({ commentId: Schema.Number }))(input),
  )
  .handler(
    createHandler(
      deleteCommentEffect,
      CommentsServiceLive,
      baseLayerFactories.auth,
    ),
  );
```

## `createHandler` Bridge

The `createHandler` function (`src/lib/server-fn.handler.ts`) bridges TanStack Start `createServerFn` to Effect services:

- First argument: an `Effect.fn` that takes `TParams` and returns `Effect<A, Error>`
- Second argument: the `Layer` providing the service dependencies
- Third argument (optional): the base layer factory — `baseLayerFactories.db` by default, `baseLayerFactories.auth` for authenticated routes

At runtime, it:

1. Dynamically imports the base layer factory (avoids bundling server code on client)
2. Merges the service layer with the base layer
3. Runs the Effect to completion via `Effect.runPromise`

## Validation

- Server function input must be validated with Effect Schema in `.validator()` calls
- Schemas are typically defined in `src/lib/<feature>/<feature>.schema.ts`
- Some simple validators are inlined (e.g., `parse(Schema.Number)(input)` for single params)
- FormData uploads require manual parsing before Effect Schema validation (see `uploadPost` in `posts.service.ts`)

## Auth Middleware

- Auth-protected mutations import `makeAuthLayer` from `src/lib/db/layer-factories.server` and pass it as the third argument to `createHandler`
- Session effects live in `src/lib/auth/session.effect.ts`: `getSessionEffect()` (Better Auth session via `AuthService` + `RequestHeadersService`) and `getUserSessionEffect()` (returns user or null)
- `src/lib/auth/auth.middleware.ts` exposes the client-safe TanStack server function `getUserSession`, which dynamically imports `getUserSessionEffect` and runs it with the middleware layer
- Ownership checks are performed within the Effect service method using `Effect.fail(new UnauthorizedError({...}))` or `Effect.fail(new ForbiddenError({...}))`

## Effective Service Files

| Feature   | Service file                             |
| --------- | ---------------------------------------- |
| Comments  | `src/lib/comments/comments.service.ts`   |
| Playlists | `src/lib/playlists/playlists.service.ts` |
| Posts     | `src/lib/posts/posts.service.ts`         |
| Tags      | `src/lib/tags/tags.service.ts`           |
| Users     | `src/lib/users/users.service.ts`         |
| Votes     | `src/lib/votes/votes.service.ts`         |

## Error Handling

- Services throw typed `Schema.TaggedError` classes from `src/lib/errors.ts`
- Errors propagate through Effect's error channel and are caught by `createHandler` which logs them via `Effect.logError`
- Callers (client-side) should use React Query's `onError` / `.catch()` for error handling
- Avoid `try-catch` within service methods — use Effect's `Effect.try`, `Option.match`, and tagged errors
