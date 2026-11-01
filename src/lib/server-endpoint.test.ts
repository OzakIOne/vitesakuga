import { Context, Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ForbiddenError, ValidationError } from "./errors";
import { createEndpointHandler } from "./server-endpoint";

class MarkerService extends Context.Service<
  MarkerService,
  { readonly label: string }
>()("MarkerService") {}

class OtherService extends Context.Service<
  OtherService,
  { readonly value: string }
>()("OtherService") {}

class UnmarkedError extends Schema.TaggedError<UnmarkedError>()(
  "UnmarkedError",
  { message: Schema.String },
) {}

type ProbeShape = {
  readonly echo: (input: {
    value: number;
  }) => Effect.Effect<{ doubled: number }>;
  readonly label: () => Effect.Effect<string, never, MarkerService>;
  readonly needsOther: () => Effect.Effect<string, never, OtherService>;
  readonly forbidden: () => Effect.Effect<never, ForbiddenError>;
  readonly invalid: () => Effect.Effect<never, ValidationError>;
  readonly unmarked: () => Effect.Effect<never, UnmarkedError>;
  readonly defect: () => Effect.Effect<never>;
};

class ProbeService extends Context.Service<ProbeService, ProbeShape>()(
  "ProbeService",
) {}

const ProbeLive = Layer.effect(
  ProbeService,
  Effect.succeed<ProbeShape>({
    echo: (input) => Effect.succeed({ doubled: input.value * 2 }),
    label: () => Effect.map(MarkerService, (marker) => marker.label),
    needsOther: () => Effect.map(OtherService, (other) => other.value),
    forbidden: () => Effect.fail(new ForbiddenError({ message: "staff only" })),
    invalid: () =>
      Effect.fail(
        new ValidationError({
          message: "Name is required",
          cause: "schema decode internals",
        }),
      ),
    unmarked: () =>
      Effect.fail(new UnmarkedError({ message: "row shape drifted" })),
    defect: () => Effect.die(new Error("driver exploded")),
  }),
);

const markerBase = () =>
  Promise.resolve(Layer.succeed(MarkerService, { label: "from-base" }));

const probe = { service: ProbeService, layer: ProbeLive, base: markerBase };

const GENERIC_MESSAGE_PATTERN =
  /^Something went wrong\. Debug ID: [0-9a-f-]{36}$/;

describe("createEndpointHandler", () => {
  it("runs the operation with the input and returns its output", async () => {
    const handler = createEndpointHandler({ ...probe, operation: "echo" });
    await expect(handler({ data: { value: 21 } })).resolves.toEqual({
      doubled: 42,
    });
  });

  it("runs the operation over the base layer it was declared with", async () => {
    const handler = createEndpointHandler({ ...probe, operation: "label" });
    await expect(handler({ data: undefined })).resolves.toBe("from-base");
  });

  it("rejects at compile time an operation the base layer cannot satisfy", () => {
    const unsatisfiable = createEndpointHandler({
      service: ProbeService,
      // @ts-expect-error -- OtherService is not provided by markerBase
      operation: "needsOther",
      layer: ProbeLive,
      base: markerBase,
    });
    expect(unsatisfiable).toBeTypeOf("function");
  });

  it("passes a ValidationError through with its message but not its cause", async () => {
    const handler = createEndpointHandler({ ...probe, operation: "invalid" });
    await expect(handler({ data: undefined })).rejects.toMatchObject({
      _tag: "ValidationError",
      message: "Name is required",
    });
    await expect(handler({ data: undefined })).rejects.not.toMatchObject({
      cause: "schema decode internals",
    });
  });

  it("passes a client-safe domain error through with its tag and message", async () => {
    const handler = createEndpointHandler({
      ...probe,
      operation: "forbidden",
    });
    await expect(handler({ data: undefined })).rejects.toMatchObject({
      _tag: "ForbiddenError",
      message: "staff only",
    });
  });

  it("sanitizes an unmarked domain error to the generic debug-id message", async () => {
    const handler = createEndpointHandler({ ...probe, operation: "unmarked" });
    await expect(handler({ data: undefined })).rejects.toThrow(
      GENERIC_MESSAGE_PATTERN,
    );
  });

  it("sanitizes a defect to the generic debug-id message", async () => {
    const handler = createEndpointHandler({ ...probe, operation: "defect" });
    await expect(handler({ data: undefined })).rejects.toThrow(
      GENERIC_MESSAGE_PATTERN,
    );
  });
});
