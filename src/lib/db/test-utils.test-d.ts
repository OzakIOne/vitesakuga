// oxlint-disable effecttsgo/missing-effect-context, effecttsgo/missing-layer-context -- compile-time regression cases deliberately require missing services; @ts-expect-error ensures TypeScript rejects each case
import { Context, Effect, Layer } from "effect";

import { makeServiceTestLayer, type ServiceTestContext } from "./test-utils";

class Provided extends Context.Service<Provided, { value: string }>()(
  "Provided",
) {}
class Missing extends Context.Service<Missing, { missing: true }>()(
  "Missing",
) {}

declare const context: ServiceTestContext<Provided>;
await context.runEffect(Provided);
// @ts-expect-error Missing is not supplied by this context.
await context.runEffect(Missing);
// @ts-expect-error The failure runner must also enforce requirements.
await context.runFailure(Missing);

const requiresMissing = Layer.effect(
  Provided,
  Effect.map(Missing, () => ({ value: "ok" })),
);
// @ts-expect-error The harness cannot construct a layer requiring Missing.
await makeServiceTestLayer(requiresMissing);

const inferred = await makeServiceTestLayer(
  Layer.succeed(Provided)({ value: "ok" }),
);
await inferred.runEffect(Provided);
// @ts-expect-error Inference must preserve the services actually supplied.
await inferred.runEffect(Missing);
