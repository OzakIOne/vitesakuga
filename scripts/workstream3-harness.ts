import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "../src/lib/db/kysely";
import { makeRustFSStorageLayerAt } from "../src/lib/storage/storage.adapter";

const exec = promisify(execFile);
const root = process.cwd();

type Harness = {
  readonly db: Kysely<DB>;
  readonly pool: Pool;
  readonly storageEndpoint: string;
  readonly bucket: string;
  readonly close: () => Promise<void>;
};

const waitFor = async (check: () => Promise<boolean>) => {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("isolated service did not become ready within 45 seconds");
};

const portOf = async (container: string, port: string) => {
  const { stdout } = await exec("docker", ["port", container, port]);
  const match = stdout.match(/:(\d+)\s*$/m);
  if (!match?.[1]) throw new Error(`could not inspect ${container}:${port}`);
  return Number(match[1]);
};

export const startWorkstream3Harness = async (): Promise<Harness> => {
  const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const postgres = `vitesakuga-ws3-pg-${suffix}`;
  const rustfs = `vitesakuga-ws3-rustfs-${suffix}`;
  const bucket = `ws3-${suffix}`;
  const started: string[] = [];
  let pool: Pool | undefined;
  let db: Kysely<DB> | undefined;
  let closePromise: Promise<void> | undefined;
  try {
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      postgres,
      "-e",
      "POSTGRES_DB=ws3",
      "-e",
      "POSTGRES_USER=ws3",
      "-e",
      "POSTGRES_PASSWORD=ws3",
      "-p",
      "127.0.0.1::5432",
      "postgres:18@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280",
    ]);
    started.push(postgres);
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      rustfs,
      "-e",
      "RUSTFS_ACCESS_KEY=rustfsadmin",
      "-e",
      "RUSTFS_SECRET_KEY=rustfsadmin",
      "-p",
      "127.0.0.1::9000",
      "rustfs/rustfs:1.0.0-rc.6@sha256:97171b3d72cd47dc81000f92ea84de25608bfc35a94c965501afaeb5d99f6035",
      "--access-key",
      "rustfsadmin",
      "--secret-key",
      "rustfsadmin",
      "/data",
    ]);
    started.push(rustfs);

    const pgPort = await portOf(postgres, "5432/tcp");
    const s3Port = await portOf(rustfs, "9000/tcp");
    const connectionString = `postgresql://ws3:ws3@127.0.0.1:${pgPort}/ws3`;
    pool = new Pool({ connectionString, max: 8, min: 0 });
    const harnessPool = pool;
    await waitFor(async () => {
      try {
        await harnessPool.query("select 1");
        return true;
      } catch {
        return false;
      }
    });
    const s3 = new S3Client({
      credentials: {
        accessKeyId: "rustfsadmin",
        secretAccessKey: "rustfsadmin",
      },
      endpoint: `http://127.0.0.1:${s3Port}`,
      forcePathStyle: true,
      region: "us-east-1",
    });
    await waitFor(async () => {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        return true;
      } catch {
        return false;
      }
    });
    s3.destroy();

    const drizzleDb = drizzle({ client: pool });
    await migrate(drizzleDb, { migrationsFolder: `${root}/drizzle` });
    db = new Kysely<DB>({
      dialect: new PostgresDialect({ pool }),
    });
    const endpoint = `http://127.0.0.1:${s3Port}`;
    const readyDb = db;
    const readyPool = pool;
    if (!readyDb || !readyPool)
      throw new Error("database harness was not initialized");
    return {
      bucket,
      db: readyDb,
      pool: readyPool,
      storageEndpoint: endpoint,
      close: () => {
        closePromise ??= (async () => {
          await Promise.allSettled([db?.destroy(), pool?.end()]);
          await Promise.all(
            [...started].reverse().map(async (name) => {
              await exec("docker", ["stop", name]).catch(() => undefined);
            }),
          );
        })();
        return closePromise;
      },
    };
  } catch (error) {
    await Promise.allSettled([db?.destroy(), pool?.end()]);
    await Promise.all(
      [...started].reverse().map(async (name) => {
        await exec("docker", ["stop", name]).catch(() => undefined);
      }),
    );
    throw error;
  }
};

export const isolatedStorage = (harness: Harness) =>
  makeRustFSStorageLayerAt({
    accessKeyId: "rustfsadmin",
    bucket: harness.bucket,
    endpoint: harness.storageEndpoint,
    secretAccessKey: "rustfsadmin",
  });
