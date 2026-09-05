import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { SessionFetchError } from "./auth/session.effect";
import { SqlError } from "./effect/effect.utils";
import {
  ForbiddenError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
import { createHandler } from "./server-fn.handler";

// The boundary is exercised as a pure function: `createHandler` with empty
// layers maps a failing effect exactly the way a real server function would,
// without spinning TanStack Start.
const makeHandler =
  (effect: Effect.Effect<string, unknown, never>) =>
  ({ data }: { data: string }): Promise<string> =>
    createHandler(Layer.empty, () => Promise.resolve(Layer.empty))(
      (_data: string) => effect,
    )({ data });

/** The boundary surfaces failures as rejections, exactly like TanStack Start. */
const rejectionOf = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the server function to reject.");
};

const DEBUG_ID_PATTERN =
  /^Something went wrong\. Debug ID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("server-fn failure boundary", () => {
  // NOTE: the boundary tests intentionally use `rejects` — they assert the
  // WIRE contract (what the promise rethrows across the TanStack Start
  // transport), where an `Effect.flip` runner does not apply.
  it("passes successful results through untouched", async () => {
    const handler = makeHandler(Effect.succeed("payload:abc"));
    await expect(handler({ data: "abc" })).resolves.toBe("payload:abc");
  });

  it("passes client-safe domain errors through with tag and fields", async () => {
    const forbidden = new ForbiddenError({ message: "staff only" });
    await expect(
      makeHandler(Effect.fail(forbidden))({ data: "x" }),
    ).rejects.toBe(forbidden);

    const notFound = new PostNotFoundError({ message: "gone", postId: 42 });
    await expect(
      makeHandler(Effect.fail(notFound))({ data: "x" }),
    ).rejects.toMatchObject({ _tag: "PostNotFoundError", postId: 42 });

    await expect(
      makeHandler(
        Effect.fail(new UnauthorizedError({ message: "log in first" })),
      )({ data: "x" }),
    ).rejects.toMatchObject({ _tag: "UnauthorizedError" });
  });

  it("strips ValidationError of its cause but keeps the user-facing message", async () => {
    const internalCause = {
      issues: ["decode internals"],
      secret: "schema-path",
    };
    const error = await rejectionOf(
      makeHandler(
        Effect.fail(
          new ValidationError({
            cause: internalCause,
            message: "Invalid input.",
          }),
        ),
      )({ data: "x" }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    if (!(error instanceof ValidationError)) {
      throw new Error("unreachable: instance asserted above");
    }
    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid input.");
    expect(error.cause).toBeUndefined();
  });

  it.each([
    [
      "SqlError",
      () =>
        new SqlError({
          cause: "select * from user",
          message: "relation does not exist",
        }),
    ],
    [
      "RowParseError",
      () =>
        new RowParseError({
          cause: { expected: "number", received: "null" },
          message: "bad row",
        }),
    ],
    [
      "SessionFetchError",
      () =>
        new SessionFetchError({
          cause: "network down",
          message: "fetch failed",
        }),
    ],
    ["plain Error", () => new Error("boom: internal detail")],
  ])("replaces %s with the generic client error", async (_label, makeError) => {
    const error = await rejectionOf(
      makeHandler(Effect.fail(makeError()))({ data: "x" }),
    );

    expect(error).not.toBeInstanceOf(SqlError);
    expect(error).not.toBeInstanceOf(RowParseError);
    expect(error).not.toBeInstanceOf(SessionFetchError);
    // No internals survive: neither the driver text nor the original message.
    expect(error.message).toMatch(DEBUG_ID_PATTERN);
  });

  it("stamps a fresh debug id on every failure", async () => {
    const fail = () =>
      rejectionOf(makeHandler(Effect.fail(new Error("boom")))({ data: "x" }));

    const first = await fail();
    const second = await fail();
    const idOf = (error: Error) => error.message.split("Debug ID: ")[1] ?? "";

    expect(idOf(first)).toMatch(/^[0-9a-f-]{36}$/);
    expect(idOf(second)).toMatch(/^[0-9a-f-]{36}$/);
    expect(idOf(first)).not.toBe(idOf(second));
  });

  it.each([
    ["Error defect", () => Effect.die(new Error("internal defect detail"))],
    ["non-Error defect", () => Effect.die("raw defect string")],
  ])("sanitizes %s like typed failures", async (_label, run) => {
    const error = await rejectionOf(makeHandler(run())({ data: "x" }));
    expect(error.message).toMatch(DEBUG_ID_PATTERN);
  });

  it("sanitizes a synchronous throw from the effect factory", async () => {
    const handler = createHandler(Layer.empty, () =>
      Promise.resolve(Layer.empty),
    )((_data: string) => {
      throw new Error("arg validation boom");
    });

    const error = await rejectionOf(handler({ data: "x" }));
    expect(error.message).toMatch(DEBUG_ID_PATTERN);
  });

  it("sanitizes a rejected makeBase() promise", async () => {
    const handler = createHandler(Layer.empty, () =>
      Promise.reject(new Error("env validation failed")),
    )((_data: string) => Effect.succeed("never"));

    const error = await rejectionOf(handler({ data: "x" }));
    expect(error.message).toMatch(DEBUG_ID_PATTERN);
  });

  it("sanitizes layer construction failures", async () => {
    class BoundaryProbe extends Context.Service<BoundaryProbe, { x: 1 }>()(
      "BoundaryProbe",
    ) {}

    // Typed layer error (the layer fails while being built).
    const failingLayer = createHandler(
      Layer.effect(
        BoundaryProbe,
        Effect.fail(
          new SqlError({ cause: "secret ddl", message: "migration failed" }),
        ),
      ),
      () => Promise.resolve(Layer.empty),
    )((_data: string) => Effect.succeed("never"));
    const typedError = await rejectionOf(failingLayer({ data: "x" }));
    expect(typedError.message).toMatch(DEBUG_ID_PATTERN);

    // Defecting layer builder (a throw inside the layer construction).
    const defectingLayer = createHandler(
      Layer.effect(
        BoundaryProbe,
        Effect.sync((): { x: 1 } => {
          throw new Error("builder blew up");
        }),
      ),
      () => Promise.resolve(Layer.empty),
    )((_data: string) => Effect.succeed("never"));
    const error = await rejectionOf(defectingLayer({ data: "x" }));
    expect(error.message).toMatch(DEBUG_ID_PATTERN);
  });
});
