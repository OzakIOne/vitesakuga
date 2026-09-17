# T2 foundation contract

## Durable database state

- `posts.version` is a non-null integer defaulting to `0`.
- `post_edits.basePostVersion` is a non-null integer defaulting to `0`.
- `media_operations` persists `(userId, operationKey)` with a unique index, a canonical request fingerprint, a monotone fence, explicit `in-progress`, `completed`, `conflict`, `failed`, and `unknown` states, and a minimal identifier/state result.
- `media_objects` is keyed by the immutable storage key and records owner, operation, kind, server identity fingerprint, expected type/length, fence, and `reserved`, `preparing`, `ready`, `unknown`, `deleting`, or `deleted` state.
- Foreign keys intentionally have no cascade. Tombstone rows remain after account cleanup; the primary key prevents physical-key reuse.
- The two generated Drizzle migrations are `20260916222552_nice_ender_wiggin` (T2 columns/tables) and `20260916224126_media_lifecycle_constraints` (state, kind, fence, and length checks). Existing migrations were not edited.

## Lifecycle exports

Import from `src/lib/lifecycle` (or the direct service module):

- `LifecycleService`, `LifecycleServiceLive`, `LifecycleError`, and tagged errors (`OperationConflictError`, `OperationFenceError`, `OperationNotReadyError`, `ObjectConflictError`, `ObjectNotAdoptableError`, `ObjectProtectedError`, `PostVersionConflictError`, etc.).
- `claimOperation({ userId, operationKey, kind, requestFingerprint })`: the unique constraint elects the durable row. A same-user/key/different-kind-or-fingerprint request fails with `OperationConflictError`; a non-terminal retry claims a higher fence; a terminal retry returns `outcome: "replayed"` and the stored initial result without another CAS. The fingerprint must be `sha256:<64 lowercase hex digits>`.
- `reserveObject({ userId, operationId, fence, key, kind, fingerprint, contentType, contentLength })`: accepts only a generated `media/...` key whose namespace matches its kind, and either inserts one immutable ownership row or returns `outcome: "reused"`. Deleting, deleted, and unknown rows cannot be adopted through reservation.
- `markPreparing`, `markReady`, and `adoptObject`: every transition checks operation/object identity and fence. `markReady` accepts `observed` HEAD identity when supplied; `adoptObject` is the verified reconcile path for an unknown object and refuses deleting/deleted rows.
- `finishOperation({ operationId, fence, result })`: completes only when every object for the operation is `ready`; the result is limited to identifiers/states, not URLs. `failOperation` durably records `conflict`/`failed` terminal outcomes or quarantines as `unknown`.
- `beginDelete({ key, operationId, fence })`: under one DB transaction locks the object, checks all protected post/image/video-revision references, and commits `deleting` plus a new fence and `deletingCommittedAt`. The caller performs remote DELETE only after this Effect commits. Repeating after a lost response returns `already-deleting`.
- `completeDelete({ key, operationId, fence })`: records `deleted` after remote removal. Repeating after a lost response returns `already-deleted`; the tombstone is never removed.
- `reconcileNonTerminal({ operationId? })`: manually scans non-terminal objects. It performs HEAD outside a DB transaction, adopts only when fingerprint/type/length match, quarantines unknown reads, and retries only idempotent remote DELETE for committed `deleting` rows before completing their tombstone.
- `updatePostWithVersion` and `compareAndIncrementPostVersion`: atomic `UPDATE ... WHERE id = ? AND version = ?`, incrementing exactly once. The helpers return `PostVersionConflictError` without changing the row when the expected version is stale.

For atomic final post application, use the transaction helpers with the transaction callback supplied by `db.transaction().execute`:

```ts
return (
  yield *
  db.transaction().execute((trx) =>
    Effect.gen(function* () {
      yield* markPreparingInTransaction(trx, objectInput, now);
      yield* markReadyInTransaction(trx, objectInput, now);
      // Insert final post refs with trx here.
      return yield* finishOperationInTransaction(trx, finishInput, now);
    }),
  )
);
```

The exported transaction type is `LifecycleTransaction`; the helpers are `markPreparingInTransaction`, `markReadyInTransaction`, `adoptObjectInTransaction`, `finishOperationInTransaction`, `failOperationInTransaction`, `beginDeleteInTransaction`, `completeDeleteInTransaction`, `updatePostWithVersionInTransaction`, and `compareAndIncrementPostVersionInTransaction`.

## Request identity and storage exports

- `canonicalizeOperationRequest` produces stable sorted JSON from validated payload fields, owner, expected post version, and ordered file digests.
- `operationRequestFingerprint` hashes that canonical identity as `sha256:...`. It never hashes or persists a raw request or a presigned URL.
- `mediaObjectKey`, `videoObjectKey`, `imageObjectKey`, `thumbnailObjectKey`, and `pendingVideoObjectKey` produce deterministic keys. The `media/` final namespace is never presigned.
- `StorageModule.putImage` and `putThumbnail` read the complete `File`, calculate a server-side SHA-256, write `If-None-Match: *` plus fingerprint metadata, and treat a matching existing HEAD as an idempotent replay. A different body at the same key is rejected.
- `StorageModule.headFile` exposes the real ETag and server fingerprint metadata. `isUploadedVideoValid` now requires a non-empty real ETag in addition to size/type validation; a client-declared checksum is not treated as storage proof.
- `presignDeterministicVideoUpload(userId, pendingKey, contentType)` signs only a deterministic pending key and returns the required `if-none-match: *` header. `copyVideoIfMatch(sourceKey, sourceEtag, finalKey)` HEAD-pins the source, uses `CopySourceIfMatch`, and refuses to overwrite an existing final key unless its ETag matches. A late physical copy can therefore exist after a tombstone, but cannot become live through the lifecycle registry.
- Existing storage methods remain available for the current integrator; no posts/videos service or client code was changed.
