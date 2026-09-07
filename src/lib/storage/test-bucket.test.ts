import { DeleteBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Effect } from "effect";
import { expect, it } from "vitest";

import { ensureTestBucket } from "../../../e2e/test-bucket";

const clientFor = (secretAccessKey: string) =>
  new S3Client({
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    credentials: { accessKeyId: "rustfsadmin", secretAccessKey },
    forcePathStyle: true,
    maxAttempts: 1,
  });

it("creates a test bucket and accepts an existing owned bucket", async () => {
  const client = clientFor("rustfsadmin");
  const bucket = `setup-${crypto.randomUUID()}`;
  try {
    await expect(
      Effect.runPromise(ensureTestBucket(client, bucket)),
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(ensureTestBucket(client, bucket)),
    ).resolves.toBeUndefined();
  } finally {
    try {
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    } finally {
      client.destroy();
    }
  }
});

it("fails setup when S3 rejects the credentials", async () => {
  const client = clientFor("invalid-test-secret");
  try {
    const error = await Effect.runPromise(
      Effect.flip(ensureTestBucket(client, "e2e-test")),
    );
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error("Expected an S3 failure");
    expect(error.name).toBe("SignatureDoesNotMatch");
  } finally {
    client.destroy();
  }
});
