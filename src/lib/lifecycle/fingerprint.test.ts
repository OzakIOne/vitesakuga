import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  canonicalizeOperationRequest,
  operationRequestFingerprint,
} from "./fingerprint";

const request = {
  fileDigests: [
    { digest: "sha256:" + "a".repeat(64), slot: "image:0" },
    { digest: 'etag:"video-etag"', slot: "video" },
  ],
  operationKind: "post-create",
  payload: {
    description: "a validated description",
    title: "A title",
  },
  userId: "user-1",
  version: 0,
} as const;

describe("operation request fingerprints", () => {
  it("canonicalizes object keys and hashes only validated identity inputs", async () => {
    const reordered = {
      ...request,
      payload: { title: "A title", description: "a validated description" },
    };
    const first = await Effect.runPromise(operationRequestFingerprint(request));
    const second = await Effect.runPromise(
      operationRequestFingerprint(reordered),
    );
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(first).not.toContain("A title");

    const canonical = await Effect.runPromise(
      canonicalizeOperationRequest(request),
    );
    expect(canonical.indexOf('"description"')).toBeLessThan(
      canonical.indexOf('"title"'),
    );
  });

  it("changes identity when the owner, version, or file digest changes", async () => {
    const first = await Effect.runPromise(operationRequestFingerprint(request));
    const differentOwner = await Effect.runPromise(
      operationRequestFingerprint({ ...request, userId: "user-2" }),
    );
    const differentVersion = await Effect.runPromise(
      operationRequestFingerprint({ ...request, version: 1 }),
    );
    const differentFile = await Effect.runPromise(
      operationRequestFingerprint({
        ...request,
        fileDigests: [{ digest: "sha256:" + "b".repeat(64), slot: "image:0" }],
      }),
    );
    expect(
      new Set([first, differentOwner, differentVersion, differentFile]).size,
    ).toBe(4);
  });
});
