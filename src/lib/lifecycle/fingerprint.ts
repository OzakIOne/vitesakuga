import { Effect, Schema } from "effect";

export type CanonicalJson =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<CanonicalJson>
  | { readonly [key: string]: CanonicalJson };

export type CanonicalFileDigest = {
  readonly digest: string;
  readonly slot: string;
};

export type CanonicalOperationRequest = {
  readonly fileDigests: ReadonlyArray<CanonicalFileDigest>;
  readonly operationKind: string;
  readonly payload: CanonicalJson;
  readonly userId: string;
  readonly version?: number;
};

type CanonicalIdentity = {
  fileDigests: ReadonlyArray<CanonicalFileDigest>;
  operationKind: string;
  payload: CanonicalJson;
  schemaVersion: number;
  userId: string;
  version?: number;
};

export class FingerprintInputError extends Schema.TaggedError<FingerprintInputError>()(
  "FingerprintInputError",
  { message: Schema.String },
) {}

const canonicalizeValue = (value: CanonicalJson): string => {
  if (value === null) return "null";
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- CanonicalJson is validated before canonicalization; this discriminates its primitive domain values.
  if (typeof value === "string") return JSON.stringify(value);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- CanonicalJson is validated before canonicalization; this discriminates its primitive domain values.
  if (typeof value === "number" || typeof value === "boolean") {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- CanonicalJson is validated before canonicalization; this distinguishes numbers for the finite-number invariant.
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Canonical JSON numbers must be finite");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(",")}]`;
  }
  // SAFETY: Arrays and primitives have been excluded, so the remaining CanonicalJson value is the object variant.
  const objectValue = value as { readonly [key: string]: CanonicalJson };
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => {
      // SAFETY: Object.keys returns keys present on objectValue; CanonicalJson values are defined for every present key.
      const item = objectValue[key] as CanonicalJson;
      return `${JSON.stringify(key)}:${canonicalizeValue(item)}`;
    })
    .join(",")}}`;
};

/** Stable JSON used for operation identity; payload must already be validated. */
export const canonicalizeOperationRequest = (
  request: CanonicalOperationRequest,
): Effect.Effect<string, FingerprintInputError> =>
  Effect.try({
    try: () => {
      if (request.userId.length === 0 || request.operationKind.length === 0) {
        throw new Error("Operation identity requires a user and kind");
      }
      for (const file of request.fileDigests) {
        if (file.slot.length === 0 || file.digest.length === 0) {
          throw new Error("Every file digest must have a slot and value");
        }
      }
      const identity: CanonicalIdentity = {
        fileDigests: request.fileDigests,
        operationKind: request.operationKind,
        payload: request.payload,
        schemaVersion: 1,
        userId: request.userId,
      };
      if (request.version !== undefined) identity.version = request.version;
      return canonicalizeValue(identity);
    },
    catch: (cause) =>
      new FingerprintInputError({
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  });

/** SHA-256 of the canonical server-side request identity. */
export const operationRequestFingerprint = (
  request: CanonicalOperationRequest,
): Effect.Effect<string, FingerprintInputError> =>
  Effect.gen(function* () {
    const canonical = yield* canonicalizeOperationRequest(request);
    return yield* Effect.tryPromise({
      try: async () => {
        const bytes = new TextEncoder().encode(canonical);
        const digestBody = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(digestBody).set(bytes);
        const digest = await crypto.subtle.digest("SHA-256", digestBody);
        return `sha256:${Array.from(new Uint8Array(digest), (value) =>
          value.toString(16).padStart(2, "0"),
        ).join("")}`;
      },
      catch: (cause) =>
        new FingerprintInputError({
          message: `Failed to hash operation identity: ${String(cause)}`,
        }),
    });
  });
