# Server Functions & API Design

This document outlines the conventions and best practices for developing server functions and API design within the ViteSakuga project.

---

## Location

Server functions are embedded within Effect service files in `src/lib/<feature>/<feature>.service.ts`.

The old pattern of separate `<feature>.fn.ts` files has been consolidated — server functions (`createServerFn`) are now co-located with their Effect service definitions at the bottom of each `*.service.ts` file.

## Structure of a Service File

Each `*.service.ts` file follows this layered pattern (top to bottom):

1. **Imports** — Effect, Zod, TanStack Start, domain schemas, layer factories, `createHandler`
2. **Service class** — Effect `Context.Service` defining the typed interface
3. **Live layer** — `Layer.effect` implementing the service using `KyselyDB` and `Effect.fn`
4. **Effect functions** — Public `Effect.fn` wrappers that pull from the service (e.g., `fetchCommentsEffect`)
5. **Server functions** — TanStack Start `createServerFn` instances with Zod validators calling `createHandler`

Example pattern (from `comments.service.ts`):

```typescript
// 2. Service class
export class CommentsService extends Context.Service<CommentsService, {
  readonly fetch: (postId: number) => Effect.Effect<unknown, Error>;
  readonly add: (data: ...) => Effect.Effect<unknown, Error>;
  readonly delete_: (commentId: number) => Effect.Effect<{ success: boolean }, Error>;
}>()("CommentsService") {}

// 3. Live layer
export const CommentsServiceLive = Layer.effect(CommentsService, Effect.gen(function* () {
  const db = yield* KyselyDB;
  // ... implementation
}));

// 4. Effect functions
export const fetchCommentsEffect = Effect.fn("fetchComments")(function* (postId: number) {
  const svc = yield* CommentsService;
  return yield* svc.fetch(postId);
});

// 5. Server functions
export const fetchComments = createServerFn()
  .validator((input: unknown) => z.number().parse(input))
  .handler(createHandler(fetchCommentsEffect, CommentsServiceLive));

export const addComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => commentInsertSchema.parse(input))
  .handler(createHandler(addCommentEffect, CommentsServiceLive));

export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ commentId: z.number() }).parse(input))
  .handler(createHandler(deleteCommentEffect, CommentsServiceLive, makeAuthLayer));
```

## `createHandler` Bridge

The `createHandler` function (`src/lib/server-fn.handler.ts`) bridges TanStack Start `createServerFn` to Effect services:

- First argument: an `Effect.fn` that takes `TParams` and returns `Effect<A, Error>`
- Second argument: the `Layer` providing the service dependencies
- Third argument (optional): a `makeBaseLayer` factory for additional dependencies (e.g., `makeAuthLayer` for authenticated routes)

At runtime, it:

1. Dynamically imports the base layer factory (avoids bundling server code on client)
2. Merges the service layer with the base layer
3. Runs the Effect to completion via `Effect.runPromise`

## Validation

- Server function input must be validated with Zod schemas in `.validator()` calls
- Schemas are typically defined in `src/lib/<feature>/<feature>.schema.ts`
- Some simple validators are inlined (e.g., `z.number().parse(input)` for single params)
- FormData uploads require manual parsing before Zod validation (see `uploadPost` in `posts.service.ts`)

## Auth Middleware

- Auth-protected mutations import `makeAuthLayer` from `src/lib/db/layer-factories.server` and pass it as the third argument to `createHandler`
- Auth middleware uses `getSessionEffect()`/`requireAuthEffect()` from `src/lib/auth/auth.middleware.ts`
- Ownership checks are performed within the Effect service method using `Effect.fail(new UnauthorizedError({...}))` or `Effect.fail(new ForbiddenError({...}))`

## Effective Service Files

| Feature  | Service file                           |
| -------- | -------------------------------------- |
| Comments | `src/lib/comments/comments.service.ts` |
| Posts    | `src/lib/posts/posts.service.ts`       |
| Tags     | `src/lib/tags/tags.service.ts`         |
| Users    | `src/lib/users/users.service.ts`       |

## Error Handling

- Services throw typed `Data.TaggedError` classes from `src/lib/errors.ts`
- Errors propagate through Effect's error channel and are caught by `createHandler` which logs them via `Effect.logError`
- Callers (client-side) should use React Query's `onError` / `.catch()` for error handling
- Avoid `try-catch` within service methods — use Effect's `Effect.try`, `Option.match`, and tagged errors
