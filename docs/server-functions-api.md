# Server Functions & API Design

This document outlines the conventions and best practices for developing server functions and API design within the ViteSakuga project.

---

## Location

Server functions are embedded within Effect service files in `src/lib/<feature>/<feature>.service.ts`.

The old pattern of separate `<feature>.fn.ts` files has been consolidated — server functions (`createServerFn`) are now co-located with their Effect service definitions at the bottom of each `*.service.ts` file.

## Structure of a Service File

Each `*.service.ts` file follows this layered pattern (top to bottom):

1. **Imports** — Effect, TanStack Start, domain schemas (Effect Schema), layer factories, `createEndpointHandler` (or `createHandler` for adapters)
2. **Service class** — Effect `Context.Service<Self, Shape>()("Name", { make })` with the typed interface as `Shape` and the implementation as `make`
3. **Live layer** — `Layer.effect(Service, Service.make)` providing the service
4. **Server functions** — TanStack Start `createServerFn` instances with Effect Schema validators whose `.handler(...)` is `createEndpointHandler({ service, operation, layer, base })`

Service classes have no static accessors. Code that needs an operation outside a server function (tests, other services) yields the service tag: `Effect.flatMap(CommentsService, (service) => service.fetch(postId))`.

Example pattern (from `comments.service.ts`):

```typescript
// 2. Service class
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
}) {}

// 3. Live layer
export const CommentsServiceLive = Layer.effect(CommentsService, CommentsService.make);

// 4. Server functions
export const fetchComments = createServerFn()
  .validator((input: unknown) => parse(Schema.Number)(input))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "fetch",
      layer: CommentsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const addComment = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(commentInsertSchema)(input))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "add",
      layer: CommentsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

// Adapter: the wire input is `{ commentId }`, while the operation takes the bare id.
export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(Schema.Struct({ commentId: Schema.Number }))(input),
  )
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.auth,
    )((data: { commentId: number }) =>
      Effect.flatMap(CommentsService, (service) => service.delete_(data.commentId)),
    ),
  );
```

## `createEndpointHandler`

`createEndpointHandler` (`src/lib/server-endpoint.ts`) builds the `.handler(...)` argument for an operation on a service:

- `service`: the service tag; `operation`: a key of its shape whose requirements the layers provide (anything else is a compile error)
- `layer`: the service's live layer; `base`: the base-layer factory (`baseLayerFactories.auth` or `baseLayerFactories.db`)
- Input, success and failure types come from the operation's signature.

It wraps `createHandler`, so failures, sanitization and debug IDs behave exactly as described below. The HTTP method and the validator stay on the `createServerFn(...)` chain in the same module: TanStack's compiler only extracts a `.handler(...)` written there, and it strips the server-only handler argument from the client bundle.

Not covered, and kept as `createHandler` with an adapter lambda: handlers that reshape the wire input before calling the operation.

## `createHandler` Bridge

The `createHandler` function (`src/lib/server-fn.handler.ts`) bridges TanStack Start `createServerFn` to Effect services:

`createHandler` is curried:

- First call: the service `Layer` and the base-layer factory (`baseLayerFactories.db` for public database work, `baseLayerFactories.auth` for authenticated work)
- Second call: an effect function taking `TParams` and returning `Effect<A, E, R>` whose requirements are checked against the supplied layers
- Server functions use `parse`/`parseStrict` with Effect Schema validators; scalar payloads may use `strict: { output: false }` where TanStack's wire format cannot preserve branded primitives

The handler logs failures with a per-request debug ID and sanitizes internal failures before they cross the server-function boundary. Tagged errors whose class is declared client-safe (`clientSafeAnnotations` from `src/lib/client-safe-error.ts`) pass through; validation errors keep their message without internal causes; database, layer, defect, and unknown failures become a generic message containing the debug ID.

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

## Durable mutation contracts

Mutations that can be retried after an uncertain network response carry a client-owned `operationKey`. The caller generates it once per user intent and keeps it in the mutation variables so React Query retries reuse the same key. The server derives a canonical request fingerprint after authentication and validation; a reused key with different input is a conflict, while a terminal operation replays its stored result.

Post edits, video replacement/restoration, and post updates also use optimistic concurrency. The server compares `expectedVersion` (or the persisted edit base version) atomically with `posts.version` and increments it in the same transaction as related rows. Stale writes return a typed conflict instead of silently overwriting newer content. Database lifecycle transitions and operation completion must use the helpers in `src/lib/lifecycle/lifecycle.service.ts`; storage calls remain outside the database transaction.

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

Tagged errors survive the server-function round trip: TanStack Start serializes own properties, so the client receives an `Error` with `_tag` intact even though class identity is lost. Discriminate with `errorTag(cause)` from `src/lib/mutations/mutation-feedback.ts`; `toastError` already turns `UnauthorizedError` into a "Log in" action and `PostVersionConflictError` into a "Reload" action automatically. Concurrent-edit conflicts (`PostVersionConflictError`, `OperationConflictError`) are declared client-safe on their classes and reach the user with their message. To expose a new error's message, add `clientSafeAnnotations` as the third argument of its `Schema.TaggedError`; only mark errors whose message is written for the user.
