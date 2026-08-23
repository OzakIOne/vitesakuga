import { Effect, Option } from "effect";

/**
 * Shared ownership guard: fail with `notFound` when the resource does not
 * exist, then fail with `forbidden` unless it belongs to `userId`.
 *
 * Both error arguments are constructed tagged-error instances (yieldable
 * Effects in v4), keeping each call site explicit about which errors it can
 * produce. The owned row is returned so callers can keep using it.
 */
export const ensureOwned = <A, ENotFound, EForbidden>(args: {
  readonly resource: Option.Option<A>;
  readonly selectOwnerId: (row: NoInfer<A>) => string;
  readonly userId: string;
  readonly notFound: Effect.Effect<NoInfer<A>, ENotFound>;
  readonly forbidden: Effect.Effect<never, EForbidden>;
}): Effect.Effect<A, ENotFound | EForbidden> =>
  Option.match(args.resource, {
    onNone: () => args.notFound,
    onSome: (row) =>
      args.selectOwnerId(row) === args.userId
        ? Effect.succeed(row)
        : args.forbidden,
  });
