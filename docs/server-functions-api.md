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
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.db,
    )((postId: number) => CommentsService.fetch(postId)),
  );

export const addComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(commentInsertSchema)(input))
  .handler(createHandler(CommentsServiceLive, baseLayerFactories.auth)(CommentsService.add));

export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(Schema.Struct({ commentId: Schema.Number }))(input),
  )
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.auth,
    )((data: { commentId: number }) => CommentsService.delete_(data.commentId)),
  );
```

## `createHandler` Bridge

The `createHandler` function (`src/lib/server-fn.handler.ts`) bridges TanStack Start `createServerFn` to Effect services:

`createHandler` is curried:

- First call: the service `Layer` and the base-layer factory (`baseLayerFactories.db` for public database work, `baseLayerFactories.auth` for authenticated work)
- Second call: an effect function taking `TParams` and returning `Effect<A, E, R>` whose requirements are checked against the supplied layers
- Server functions use `parse`/`parseStrict` with Effect Schema validators; scalar payloads may use `strict: { output: false }` where TanStack's wire format cannot preserve branded primitives

The handler logs failures with a per-request debug ID and sanitizes internal failures before they cross the server-function boundary. Known user-facing tagged errors pass through; validation errors keep their message without internal causes; database, layer, defect, and unknown failures become a generic message containing the debug ID.

At runtime, it:

1. Dynamically imports the base layer factory (avoids bundling server code on client)
2. Merges the service layer with the base layer
3. Runs the Effect to completion via `Effect.runPromise`
4. Catches defects and construction failures, logs them, then maps the failure to a client-safe error

The optional base-layer factory is not a third `createHandler` argument; it is supplied in the first curried call.

## Validation

- Server function input must be validated with Effect Schema in `.validator()` calls
- Schemas are typically defined in `src/lib/<feature>/<feature>.schema.ts`
- Some simple validators are inlined (e.g., `parse(Schema.Number)(input)` for single params)
- FormData uploads require manual parsing before Effect Schema validation (see `uploadPost` in `posts.service.ts`)

## Auth Middleware

- Auth-protected mutations use `baseLayerFactories.auth` from `src/lib/server-fn.handler.ts`, which resolves `makeAuthLayer` from `src/lib/db/layer-factories.server`
- Public reads use `baseLayerFactories.db`; middleware-only session reads use `resolveMiddlewareLayer()`
- `SessionService` in `src/lib/auth/session.effect.ts` exposes `getSession()`, `getUser()`, and `requireUser()` over Better Auth plus request headers
- `src/lib/auth/auth.middleware.ts` exposes the client-safe TanStack server function `getUserSession`, which resolves the middleware layer and reads the session through `SessionService`
- Ownership checks are performed within the Effect service method using `Effect.fail(new UnauthorizedError({...}))` or `Effect.fail(new ForbiddenError({...}))`

## Effective Service Files

| Feature       | Service file                                     |
| ------------- | ------------------------------------------------ |
| Auth          | `src/lib/auth/*`                                 |
| Comments      | `src/lib/comments/comments.service.ts`           |
| Moderation    | `src/lib/moderation/moderation.service.ts`       |
| Notifications | `src/lib/notifications/notifications.service.ts` |
| Playlists     | `src/lib/playlists/playlists.service.ts`         |
| Points        | `src/lib/points/points.service.ts`               |
| Post edits    | `src/lib/post-edits/post-edits.service.ts`       |
| Posts         | `src/lib/posts/posts.service.ts`                 |
| Promotions    | `src/lib/promotions/promotions.service.ts`       |
| Reports       | `src/lib/reports/reports.service.ts`             |
| Tags          | `src/lib/tags/tags.service.ts`                   |
| Users         | `src/lib/users/users.service.ts`                 |
| Videos        | `src/lib/videos/videos.service.ts`               |
| Votes         | `src/lib/votes/votes.service.ts`                 |

## Error Handling

- Services throw typed `Schema.TaggedError` classes from `src/lib/errors.ts`
- Errors propagate through Effect's error channel and are caught by `createHandler` which logs them via `Effect.logError`
- Callers (client-side) should use React Query's `onError` / `.catch()` for error handling
- Avoid `try-catch` within service methods — use Effect's `Effect.try`, `Option.match`, and tagged errors

### Error taxonomy

- `ValidationError` — the caller's input was rejected (bad upload key, invalid video, reorder mismatch). Safe to show as a user-facing message.
- `RowParseError` — a database row failed to decode against its domain schema. This is an internal data-integrity defect, not bad user input; never render it as validation feedback.
- Every other tag names one specific failure (`PostNotFoundError`, `ForbiddenError`, …) and carries its entity ID for context.

Tagged errors survive the server-function round trip: TanStack Start serializes own properties, so the client receives an `Error` with `_tag` intact even though class identity is lost. Discriminate with `errorTag(cause)` from `src/lib/mutations/mutation-feedback.ts`; `toastError` already turns `UnauthorizedError` into a "Log in" action automatically.
