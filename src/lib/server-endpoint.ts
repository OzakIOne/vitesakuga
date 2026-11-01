import { Context, Effect, Layer } from "effect";

import { createHandler } from "./server-fn.handler";

type OperationKey<Methods, Provided> = {
  [Key in Extract<keyof Methods, string>]-?: Methods[Key] extends (
    ...args: never[]
  ) => Effect.Effect<infer _Success, infer _Failure, infer Requirement>
    ? [Requirement] extends [Provided]
      ? Key
      : never
    : never;
}[Extract<keyof Methods, string>];

type OperationInput<
  Methods,
  Operation extends keyof Methods,
> = Methods[Operation] extends (...args: infer Args) => infer _Result
  ? Args[0]
  : never;

type OperationSuccess<
  Methods,
  Operation extends keyof Methods,
> = Methods[Operation] extends (
  ...args: never[]
) => Effect.Effect<infer Success, infer _Failure, infer _Requirement>
  ? Success
  : never;

type OperationFailure<
  Methods,
  Operation extends keyof Methods,
> = Methods[Operation] extends (
  ...args: never[]
) => Effect.Effect<infer _Success, infer Failure, infer _Requirement>
  ? Failure
  : never;

/**
 * The handler half of a TanStack Start server function: a service operation
 * runs against the service layer over the chosen base layer, with failures
 * flowing through `createHandler`. Only operations whose requirements the
 * layers provide are accepted. Call it inside the `.handler(...)` of a
 * `createServerFn(...)` chain written in the same module, which keeps the
 * TanStack compiler able to extract it.
 */
export const createEndpointHandler = <
  Identifier,
  Methods extends object,
  Operation extends OperationKey<Methods, Identifier | BaseOut>,
  ServiceError,
  BaseOut,
  BaseError,
  ServiceIn extends BaseOut,
>(config: {
  readonly service: Context.Key<Identifier, Methods>;
  readonly operation: Operation;
  readonly layer: Layer.Layer<Identifier, ServiceError, ServiceIn>;
  readonly base: () => Promise<Layer.Layer<BaseOut, BaseError, never>>;
}) => {
  const runOperation = Effect.fn(`${config.service.key}.${config.operation}`)(
    function* (data: OperationInput<Methods, Operation>) {
      const instance = yield* config.service;
      // SAFETY: `Operation` is constrained to keys whose value is an operation
      // with requirements the layers provide, so the member has this signature.
      const call = instance[config.operation] as (
        data: OperationInput<Methods, Operation>,
      ) => Effect.Effect<
        OperationSuccess<Methods, Operation>,
        OperationFailure<Methods, Operation>,
        Identifier | BaseOut
      >;
      return yield* call(data);
    },
  );
  return createHandler(config.layer, config.base)(runOperation);
};
