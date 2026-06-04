import { PGlite } from "@electric-sql/pglite";
import { Effect, Layer } from "effect";
import { Kysely } from "kysely";
import { vi } from "vitest";

import { AuthService } from "../auth/context";
import type { AuthSessionProvider } from "../auth/context";
import { RequestHeadersService } from "../auth/context";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel, Debug } from "../effect/logger";
import { KyselyDB } from "./context";
import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "user" (
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "id" TEXT PRIMARY KEY,
  "image" TEXT,
  "name" TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "id" SERIAL PRIMARY KEY,
  "relatedPostId" INTEGER,
  "source" TEXT,
  "thumbnailKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id"),
  "videoKey" TEXT NOT NULL,
  "videoMetadata" JSON NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tags (
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
  "postId" INTEGER NOT NULL REFERENCES posts("id") ON DELETE CASCADE,
  "tagId" INTEGER NOT NULL REFERENCES tags("id") ON DELETE CASCADE,
  PRIMARY KEY ("postId", "tagId")
);

CREATE TABLE IF NOT EXISTS comments (
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "id" SERIAL PRIMARY KEY,
  "postId" BIGINT NOT NULL REFERENCES posts("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"("id")
);
`;

const LOG_LAYER = withMinimumLogLevel(Debug);

export const runSchema = async (pg: PGlite) => {
  await pg.exec(SCHEMA_DDL);
};

export const createTestKysely = async () => {
  const pg = await PGlite.create("memory://");
  await runSchema(pg);
  const db = new Kysely<DB>({ dialect: new PGliteDialect(pg) });
  return { pg, db } as const;
};

export const makeTestLayer = (
  db: Kysely<DB>,
  auth: AuthSessionProvider | null,
  headers: () => Headers,
) =>
  Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(db)),
    Layer.succeed(AuthService)(
      auth ?? { api: { getSession: async () => null } },
    ),
    Layer.succeed(RequestHeadersService)(headers),
    LOG_LAYER,
  );

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
