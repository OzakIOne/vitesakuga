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
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel, Debug } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { makeTestStorageLayer } from "../storage/storage.test";
import { KyselyDB } from "./context";
import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";
import * as schema from "./schema";

const LOG_LAYER = withMinimumLogLevel(Debug);

export const createTestKysely = async () => {
  const pg = await PGlite.create("memory://");
  const drizzleDb = drizzle(pg, { schema });

  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(drizzleDb, { migrationsFolder });

  const db = new Kysely<DB>({ dialect: new PGliteDialect(pg) });
  return { pg, db } as const;
};

export const makeTestLayer = (
  db: Kysely<DB>,
  auth: AuthSessionProvider | null,
  headers: () => Headers,
) => {
  const { layer: storageLayer } = makeTestStorageLayer();
  return Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(db)),
    Layer.succeed(AuthService)(
      auth ?? { api: { getSession: async () => null } },
    ),
    Layer.succeed(RequestHeadersService)(headers),
    storageLayer,
    LOG_LAYER,
    TracingLive,
  );
};

export interface ServiceTestContext {
  db: Kysely<DB>;
  testLayer: Layer.Layer<any, any>;
  runEffect: <T>(effect: Effect.Effect<T>) => Promise<T>;
  mockGetSession: ReturnType<typeof vi.fn>;
}

export const makeServiceTestLayer = async (
  serviceLive: Layer.Layer<any, any>,
): Promise<ServiceTestContext> => {
  const { db } = await createTestKysely();
  const mockGetSession = vi.fn();
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
