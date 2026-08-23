import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Effect, Layer } from "effect";
import { Kysely } from "kysely";
import { vi } from "vitest";

import { AuthService } from "../auth/context";
import type { AuthSessionProvider } from "../auth/context";
import { RequestHeadersService } from "../auth/context";
import { SessionServiceLive } from "../auth/session.effect";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { makeRustFSStorageLayer } from "../storage/storage.adapter";
import { KyselyDB } from "./context";
import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";

const LOG_LAYER = withMinimumLogLevel("Debug");

const createTestKysely = async () => {
  const pg = await PGlite.create("memory://");
  const drizzleDb = drizzle({ client: pg });

  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(drizzleDb, { migrationsFolder });

  const db = new Kysely<DB>({ dialect: new PGliteDialect(pg) });
  return { pg, db } as const;
};

const makeTestLayer = (
  db: Kysely<DB>,
  auth: AuthSessionProvider | null,
  headers: () => Headers,
) => {
  const storageLayer = makeRustFSStorageLayer();
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

export type ServiceTestContext = {
  db: Kysely<DB>;
  testLayer: Layer.Layer<unknown, unknown>;
  runEffect: <T>(effect: Effect.Effect<T>) => Promise<T>;
  mockGetSession: ReturnType<typeof vi.fn>;
};

export const makeServiceTestLayer = async (
  serviceLive: Layer.Layer<unknown, unknown>,
): Promise<ServiceTestContext> => {
  const { db } = await createTestKysely();
  const mockGetSession = vi.fn<AuthSessionProvider["api"]["getSession"]>();
  // SAFETY: mockGetSession is a vi.fn implementing AuthSessionProvider["api"]["getSession"],
  // so the inline object widens to the provider contract only via that matching signature.
  const baseLayer = makeTestLayer(
    db,
    { api: { getSession: mockGetSession } } as AuthSessionProvider,
    () => new Headers(),
  );
  const testLayer = serviceLive.pipe(Layer.provideMerge(baseLayer));
  const runEffect = <T>(effect: Effect.Effect<T>) =>
    Effect.runPromise(effect.pipe(Effect.provide(testLayer)));
  return { db, testLayer, runEffect, mockGetSession };
};
