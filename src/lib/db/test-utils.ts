import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Effect, Layer } from "effect";
import { Kysely } from "kysely";
import { vi, type Mock } from "vitest";

import { AuthService } from "../auth/context";
import type { AuthSessionProvider } from "../auth/context";
import { RequestHeadersService } from "../auth/context";
import { SessionServiceLive } from "../auth/session.effect";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { makeRustFSStorageLayer } from "../storage/storage.adapter";
import { StorageError, StorageModule } from "../storage/storage.module";
import { KyselyDB } from "./context";
import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";

const LOG_LAYER = withMinimumLogLevel("Debug");

// ---------------------------------------------------------------------------
// Worker-shared PGlite
//
// Creating a fresh in-memory Postgres and replaying all 20+ migrations per
// test cost several hundred milliseconds of CPU per test; multiplied across
// parallel vitest workers that pushed DB-heavy tests past their 5s timeout
// purely on contention. One PGlite instance is created and migrated per test
// file (vitest isolates module state per file), and `resetTables` truncates
// every table — resetting identity sequences — so each test still starts
// from an empty, current schema.
// ---------------------------------------------------------------------------

const createTestKysely = async () => {
  const pg = await PGlite.create("memory://");
  const drizzleDb = drizzle({ client: pg });

  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(drizzleDb, { migrationsFolder });

  const db = new Kysely<DB>({ dialect: new PGliteDialect(pg) });
  return { pg, db } as const;
};

let fileDb: { pg: PGlite; db: Kysely<DB> } | undefined;

// SAFETY: the worker realm is shared across isolated test files; this global
// only ever holds this module's own file-scoped instance.
// Vitest workers reuse their JS realm across isolated files, so the previous
// file's instance is parked here until the next file claims it — otherwise
// one unclosed PGlite per file would accumulate in each worker.
const workerStore = globalThis as typeof globalThis & {
  __vitesakugaTestDb?: { pg: PGlite; db: Kysely<DB> } | undefined;
};

const getFileDb = async () => {
  if (fileDb) {
    return fileDb;
  }
  const stale = workerStore.__vitesakugaTestDb;
  delete workerStore.__vitesakugaTestDb;
  if (stale) {
    try {
      await stale.pg.close();
    } catch {
      // A stale instance that refuses to close must not break the new file.
    }
  }
  fileDb = await createTestKysely();
  workerStore.__vitesakugaTestDb = fileDb;
  return fileDb;
};

/** Empty every table and reset identity sequences. */
const resetTables = async (pg: PGlite, db: Kysely<DB>) => {
  const tables = await db.introspection.getTables();
  const names = tables
    .filter((table) => table.schema === "public")
    .map((table) => `"${table.name}"`);
  if (names.length === 0) {
    return;
  }
  // Table names come from our own schema introspection, so quoting them is
  // sufficient; no user input ever reaches this statement.
  await pg.exec(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`);
};

const makeTestLayer = (
  db: Kysely<DB>,
  auth: AuthSessionProvider | null,
  headers: () => Headers,
  storageLayer: Layer.Layer<StorageModule, StorageError>,
) => {
  // SessionService is the single auth dependency services require; it sits
  // on top of the mocked Better Auth provider so mockGetSession keeps
  // driving every session-related test.
  const sessionLayer = SessionServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthService)(
          auth ?? { api: { getSession: async () => null } },
        ),
        Layer.succeed(RequestHeadersService)(headers),
      ),
    ),
  );
  return Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(db)),
    sessionLayer,
    storageLayer,
    LOG_LAYER,
    TracingLive,
  );
};

// ---------------------------------------------------------------------------
// RustFS key tracking (journal-at-write cleanup)
//
// Parallel vitest workers share the `e2e-test` bucket, so cleanup must never
// enumerate the bucket: a baseline-snapshot + listing sweep races with other
// workers' uploads (their objects are missing from our baseline, so a
// concurrent cleanup deletes them), and RustFS listing can lag recent writes,
// stranding keys. Instead every mutating StorageModule operation journals
// exactly the keys this context created; cleanup deletes only those keys.
// ---------------------------------------------------------------------------

type StorageKeyJournal = {
  readonly created: Set<string>;
  readonly deleted: Set<string>;
};

/** Wrap a storage service so it journals every key it creates or deletes. */
const journalStorageService = (
  storage: StorageModule["Service"],
  journal: StorageKeyJournal,
): StorageModule["Service"] => {
  const recordCreated = (key: string) =>
    Effect.sync(() => {
      journal.created.add(key);
    });
  return {
    ...storage,
    deleteFile: (key) =>
      storage.deleteFile(key).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            journal.deleted.add(key);
          }),
        ),
      ),
    uploadImage: (userId, file) =>
      storage
        .uploadImage(userId, file)
        .pipe(Effect.tap(({ key }) => recordCreated(key))),
    uploadThumbnail: (userId, file) =>
      storage
        .uploadThumbnail(userId, file)
        .pipe(Effect.tap(({ key }) => recordCreated(key))),
    uploadVideo: (userId, file) =>
      storage
        .uploadVideo(userId, file)
        .pipe(Effect.tap(({ key }) => recordCreated(key))),
    // A presigned PUT writes bytes straight from the test to RustFS without
    // passing through this module, so the staged key is journaled here.
    presignVideoUpload: (userId, ext) =>
      storage
        .presignVideoUpload(userId, ext)
        .pipe(Effect.tap(({ key }) => recordCreated(key))),
    finalizeVideoUpload: (pendingKey) =>
      storage
        .finalizeVideoUpload(pendingKey)
        .pipe(Effect.tap(({ key }) => recordCreated(key))),
  };
};

/** Layer form: real RustFS behavior with key journaling on top. */
const makeJournaledStorageLayer = (
  journal: StorageKeyJournal,
): Layer.Layer<StorageModule, StorageError> =>
  Layer.effect(
    StorageModule,
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return journalStorageService(storage, journal);
    }).pipe(Effect.provide(makeRustFSStorageLayer())),
  );

/** A live StorageModule backed by the shared local RustFS bucket. */
const makeTestStorage = async () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* StorageModule;
    }).pipe(Effect.provide(makeRustFSStorageLayer())),
  );

export type StorageKeyTracker = {
  /** Keys this context created and has not deleted itself. */
  readonly createdKeys: ReadonlyArray<string>;
  /** Deletes exactly the keys this context created and has not removed. */
  readonly cleanup: () => Promise<void>;
};

export type StorageKeyTrackerBundle = {
  storageLayer: Layer.Layer<StorageModule, StorageError>;
  tracker: StorageKeyTracker;
};

/**
 * Create the journaled storage layer for one test context plus its tracker.
 * Cleanup replays deletions through an untracked RustFS service, so keys a
 * test deleted itself are not re-charged.
 */
export const makeStorageKeyTracker = (): StorageKeyTrackerBundle => {
  const journal: StorageKeyJournal = { created: new Set(), deleted: new Set() };
  return {
    storageLayer: makeJournaledStorageLayer(journal),
    tracker: {
      get createdKeys() {
        return [...journal.created];
      },
      cleanup: async () => {
        if (journal.created.size === 0) {
          return;
        }
        const storage = await makeTestStorage();
        // Mark before deleting so a repeated cleanup cannot double-delete.
        const pending = [...journal.created].filter(
          (key) => !journal.deleted.has(key),
        );
        for (const key of pending) {
          journal.deleted.add(key);
        }
        const failures: { readonly error: unknown; readonly key: string }[] =
          [];
        // Bounded concurrency: a big journal (e.g. the 1001-key pagination
        // test) must not pay a sequential round-trip per key.
        const DELETE_CONCURRENCY = 16;
        for (
          let start = 0;
          start < pending.length;
          start += DELETE_CONCURRENCY
        ) {
          const chunk = pending.slice(start, start + DELETE_CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map((key) => Effect.runPromise(storage.deleteFile(key))),
          );
          for (const [index, result] of results.entries()) {
            const key = chunk[index];
            if (result.status === "rejected" && key !== undefined) {
              // Keep going: one stuck key must not strand the rest of the
              // journal in the shared bucket.
              failures.push({ error: result.reason, key });
            }
          }
        }
        if (failures.length > 0) {
          const first = failures[0];
          throw new Error(
            `Storage cleanup failed for ${failures.length} key(s) — first: ${first?.key} (${String(first?.error)})`,
          );
        }
      },
    },
  };
};

// ---------------------------------------------------------------------------
// Service test layer
// ---------------------------------------------------------------------------

/**
 * What one test context exposes. `L` is the merged layer the context runs
 * effects against: the suite's own service layer merged with the harness
 * infrastructure (PGlite Kysely, session mocks, journaled RustFS storage,
 * logging, tracing). The default accepts every layer; per-suite contexts
 * infer their concrete `L`.
 *
 * The runners below take their effect's requirement channel as `any` rather
 * than a generic parameter: a generic signature with a per-suite constraint
 * (e.g. `R extends VideosService | KyselyDB | …`) is not assignable to a
 * generic signature with any other constraint, so a shared declaration like
 * `let runEffect: ServiceTestContext["runEffect"]` could never be assigned
 * a concrete context's runner. With `R = any`, every effect fits — at
 * runtime the context's layer resolves all requirements anyway.
 */
export type ServiceTestContext<L extends Layer.Any = Layer.Any> = {
  db: Kysely<DB>;
  testLayer: L;
  // oxlint-disable-next-line typescript/no-explicit-any -- see doc comment: the runner must accept any suite's requirement channel
  runEffect: <A, E>(effect: Effect.Effect<A, E, any>) => Promise<A>;
  // oxlint-disable-next-line typescript/no-explicit-any -- see doc comment: same runner semantics, flipped to the failure channel
  runFailure: <A, E>(effect: Effect.Effect<A, E, any>) => Promise<E>;
  mockGetSession: Mock<AuthSessionProvider["api"]["getSession"]>;
  storageTracker: StorageKeyTracker;
  close: () => Promise<void>;
};

export type MakeServiceTestLayerOptions = {
  /**
   * Intercept the journaled storage service before it reaches the service
   * layer. GC tests use this to scope `listKeys` to keys the test itself
   * created, so orphan analysis cannot observe (and delete) other workers'
   * objects in the shared bucket.
   */
  readonly wrapStorage?: (
    storage: StorageModule["Service"],
  ) => StorageModule["Service"];
};

export const makeServiceTestLayer = async <ROut, E, RIn>(
  serviceLive: Layer.Layer<ROut, E, RIn>,
  options: MakeServiceTestLayerOptions = {},
) => {
  const { pg, db } = await getFileDb();
  // Every context starts from an empty database with the current schema.
  await resetTables(pg, db);
  const { storageLayer: journaledStorageLayer, tracker } =
    makeStorageKeyTracker();
  const wrapStorage = options.wrapStorage;
  const storageLayer = wrapStorage
    ? Layer.effect(
        StorageModule,
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return wrapStorage(storage);
        }).pipe(Effect.provide(journaledStorageLayer)),
      )
    : journaledStorageLayer;
  const mockGetSession = vi.fn<AuthSessionProvider["api"]["getSession"]>();
  const baseLayer = makeTestLayer(
    db,
    { api: { getSession: mockGetSession } },
    () => new Headers(),
    storageLayer,
  );
  const testLayer = serviceLive.pipe(Layer.provideMerge(baseLayer));
  // SAFETY: the harness layer supplies every infrastructure requirement, so
  // any effect whose requirements sit inside the merged layer's success
  // channel runs to completion. TypeScript cannot prove `Exclude<R, ROut>`
  // collapses to `never` for a generic `R`, hence the narrow cast.
  const runEffect = <A, E2, R extends Layer.Success<typeof testLayer>>(
    effect: Effect.Effect<A, E2, R>,
  ): Promise<A> =>
    Effect.runPromise(
      effect.pipe(Effect.provide(testLayer)) as Effect.Effect<A, E2>,
    );
  const runFailure = <A, E2, R extends Layer.Success<typeof testLayer>>(
    effect: Effect.Effect<A, E2, R>,
  ): Promise<E2> =>
    // SAFETY: same invariant as `runEffect` above — the merged layer resolves
    // every requirement, so the flipped effect runs to completion.
    Effect.runPromise(
      Effect.flip(effect).pipe(Effect.provide(testLayer)) as Effect.Effect<
        E2,
        A
      >,
    );
  const close = async () => {
    // PGlite is shared per file and reset by the next context's creation, so
    // there is no per-test instance to leak: neither a cleanup failure nor a
    // tracker-construction failure can strand one (the tracker is created
    // synchronously). Only the RustFS keys this context created need
    // replaying; cleanup deletes every journaled key even if some deletes
    // fail, and reports the failures at the end.
    await tracker.cleanup();
  };
  return {
    db,
    testLayer,
    runEffect,
    runFailure,
    mockGetSession,
    storageTracker: tracker,
    close,
  };
};
