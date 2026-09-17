// oxlint-disable effecttsgo/any-unknown-in-error-context -- Effect.contextWith preserves the caller's generic environment R at this Promise boundary.
// oxlint-disable effecttsgo/async-function -- Kysely requires an async Promise callback; replacing it with an Effect would break the Driver contract.
import { Cause, Effect, Exit, Option, Schema } from "effect";
import type {
  Compilable,
  Kysely,
  QueryExecutorProvider,
  QueryResult,
  RawBuilder,
  Transaction,
  TransactionBuilder,
} from "kysely";

// taken from https://github.com/Effect-TS/effect/pull/5156

export type SqlTransactionStage =
  | "begin"
  | "callback"
  | "commit"
  | "rollback"
  | "release"
  | "unknown";

export type SqlTransactionOutcome =
  | "commit-confirmed"
  | "rollback-confirmed"
  | "not-committed"
  | "unknown";

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Unknown,
  message: Schema.String,
  stage: Schema.optional(
    Schema.Literals([
      "begin",
      "callback",
      "commit",
      "rollback",
      "release",
      "unknown",
    ]),
  ),
  outcome: Schema.optional(
    Schema.Literals([
      "commit-confirmed",
      "rollback-confirmed",
      "not-committed",
      "unknown",
    ]),
  ),
}) {}

type EffectExecutor = {
  executeRaw: <O>(
    query: QueryRaw<O>,
  ) => Effect.Effect<QueryResult<O>, SqlError>;
  execute: <O>(query: Query<O>) => Effect.Effect<O[], SqlError>;
  executeTakeFirstOption: <O>(
    query: Query<O>,
  ) => Effect.Effect<Option.Option<O>, SqlError>;
  executeTakeFirstOrUndefined: <O>(
    query: Query<O>,
  ) => Effect.Effect<O | undefined, SqlError>;
  executeTakeFirstOrError: <O>(
    query: Query<O>,
  ) => Effect.Effect<O, SqlError | SqlNoFirstResult>;
  executeTakeFirstUnsafe: <O>(query: Query<O>) => Effect.Effect<O, SqlError>;
};

export type EffectTransition<DB> = {} & Omit<
  Transaction<DB>,
  "transaction" | "startTransaction" | "executeQuery"
> &
  EffectExecutor;

export type EffectTransactionBuilder<DB> = Omit<
  TransactionBuilder<DB>,
  "execute" | "setAccessMode" | "setIsolationLevel"
> & {
  setAccessMode: (
    accessMode: Parameters<TransactionBuilder<DB>["setAccessMode"]>[0],
  ) => EffectTransactionBuilder<DB>;
  setIsolationLevel: (
    isolationLevel: Parameters<TransactionBuilder<DB>["setIsolationLevel"]>[0],
  ) => EffectTransactionBuilder<DB>;
  execute: <A, E, R>(
    f: (trx: EffectTransition<DB>) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | SqlError, R>;
};

export type EffectKysely<DB> = {
  transaction: () => EffectTransactionBuilder<DB>;
} & Omit<Kysely<DB>, "transaction" | "startTransaction" | "executeQuery"> &
  EffectExecutor;

const EFFECT_KYSELY_MARKER = Symbol.for("vitesakuga.effectKysely");

type MarkedKysely<DB> = Kysely<DB> & {
  readonly [EFFECT_KYSELY_MARKER]?: EffectKysely<DB>;
};

const makeExecutor = <DB>(
  client: Kysely<DB>,
  drainQueries = false,
): EffectExecutor => {
  const protect = <A, E>(effect: Effect.Effect<A, E>) =>
    drainQueries ? Effect.uninterruptible(effect) : effect;
  return {
    executeRaw: <O>(query: QueryRaw<O>) => protect(executeRaw(client)(query)),
    execute: <O>(query: Query<O>) => protect(execute(client)(query)),
    executeTakeFirstOption: <O>(query: Query<O>) =>
      protect(executeTakeFirstOption(client)(query)),
    executeTakeFirstOrUndefined: <O>(query: Query<O>) =>
      protect(executeTakeFirstOrUndefined(client)(query)),
    executeTakeFirstOrError: <O>(query: Query<O>) =>
      protect(executeTakeFirstOrError(client)(query)),
    executeTakeFirstUnsafe: <O>(query: Query<O>) =>
      protect(executeTakeFirstUnsafe(client)(query)),
  };
};

class TransactionCallbackFailure<E> {
  readonly _tag = "TransactionCallbackFailure";

  constructor(readonly cause: Cause.Cause<E>) {}
}

const isTransactionCallbackFailure = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Promise rejection values cross Kysely's untyped boundary and are only used after this guard.
  error: unknown,
): error is TransactionCallbackFailure<unknown> =>
  error instanceof TransactionCallbackFailure;

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Schema.is is the runtime parser for values rejected by Kysely.
const isSqlError = (error: unknown): error is SqlError =>
  Schema.is(SqlError)(error);

const transactionError = (
  cause: unknown,
  stage: SqlTransactionStage = "unknown",
  outcome: SqlTransactionOutcome = "unknown",
) =>
  isSqlError(cause)
    ? cause
    : new SqlError({
        cause,
        message: `[transaction:${stage}] SqlError: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        stage,
        outcome,
      });

const logCleanupFailure = (error: SqlError) =>
  Effect.logWarning("Kysely transaction cleanup failed", error);

const resumeWithCleanupFailure = <A, E>(
  resume: (effect: Effect.Effect<A, E>) => void,
  effect: Effect.Effect<A, E>,
  cleanupFailure?: SqlError,
) =>
  resume(
    cleanupFailure
      ? logCleanupFailure(cleanupFailure).pipe(Effect.flatMap(() => effect))
      : effect,
  );

const resumeCause = <A, E, C>(
  resume: (effect: Effect.Effect<A, E>) => void,
  cause: Cause.Cause<C>,
  cleanupFailure?: SqlError,
) => {
  // SAFETY: `resume` owns the callback's declared error channel; the cause is
  // deliberately replayed unchanged, so only the channel's static type differs.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- Cause<C> must be replayed into the callback's declared E | SqlError channel without changing its runtime value.
  const failure = Effect.failCause(cause) as unknown as Effect.Effect<A, E>;
  return resumeWithCleanupFailure(resume, failure, cleanupFailure);
};

export const makeFromKysely = <DB>(kysely: Kysely<DB>): EffectKysely<DB> => {
  // SAFETY: MarkedKysely<DB> is Kysely<DB> plus one optional symbol property,
  // so reading that property off any Kysely instance is always valid and
  // yields EffectKysely<DB> | undefined when the marker was never set.
  const existing = (kysely as MarkedKysely<DB>)[EFFECT_KYSELY_MARKER];
  if (existing) {
    return existing;
  }

  const kyselyTransaction = kysely.transaction.bind(kysely);

  const wrapped = Object.assign(kysely, {
    ...makeExecutor(kysely),
    transaction: (() => {
      const makeBuilder = (
        builder: TransactionBuilder<DB>,
      ): EffectTransactionBuilder<DB> => {
        const kyselyBuilderExecute = builder.execute.bind(builder);
        const kyselySetAccessMode = builder.setAccessMode.bind(builder);
        const kyselySetIsolationLevel = builder.setIsolationLevel.bind(builder);

        // Object.assign preserves the TransactionBuilder methods.
        // The replacement execute method has the Effect callback contract below.
        const effectBuilder = Object.assign(builder, {
          setAccessMode: (
            accessMode: Parameters<TransactionBuilder<DB>["setAccessMode"]>[0],
          ) => makeBuilder(kyselySetAccessMode(accessMode)),
          setIsolationLevel: (
            isolationLevel: Parameters<
              TransactionBuilder<DB>["setIsolationLevel"]
            >[0],
          ) => makeBuilder(kyselySetIsolationLevel(isolationLevel)),
          execute: (<A, E, R>(
            f: (trx: EffectTransition<DB>) => Effect.Effect<A, E, R>,
          ) =>
            Effect.contextWith((context) =>
              Effect.option(Effect.currentSpan).pipe(
                Effect.flatMap((parentSpan) =>
                  Effect.callback<A, E | SqlError>((resume, signal) => {
                    let callbackExit: Exit.Exit<A, E> | undefined;
                    let cleanupFailure: SqlError | undefined;

                    // The Kysely callback must stay pending until every
                    // transaction phase has settled. Effect.callback's cleanup
                    // waits for this promise without interruption, so Kysely
                    // cannot start rollback while non-cancellable SQL is still
                    // running and the caller cannot observe completion early.
                    const complete = kyselyBuilderExecute(async (trx) => {
                      const callback = Effect.suspend(() =>
                        signal.aborted
                          ? Effect.interrupt
                          : f(Object.assign(trx, makeExecutor(trx, true))),
                      );
                      const contextualCallback = Option.match(parentSpan, {
                        onNone: () => callback,
                        onSome: (span) => Effect.withParentSpan(callback, span),
                      });
                      callbackExit = await Effect.runPromiseExitWith(context)(
                        contextualCallback,
                        { signal },
                      );
                      if (Exit.isFailure(callbackExit)) {
                        throw new TransactionCallbackFailure(
                          callbackExit.cause,
                        );
                      }
                      return callbackExit.value;
                    });
                    void complete.then(
                      (value) => resume(Effect.succeed(value)),
                      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Kysely rejects with an untyped Promise value; the branches below parse it before use.
                      (error: unknown) => {
                        if (callbackExit && Exit.isFailure(callbackExit)) {
                          if (
                            isSqlError(error) &&
                            error.stage === "release" &&
                            error.outcome === "rollback-confirmed"
                          ) {
                            cleanupFailure = error;
                            return resumeCause(
                              resume,
                              callbackExit.cause,
                              error,
                            );
                          }

                          if (isTransactionCallbackFailure(error)) {
                            return resumeCause(resume, error.cause);
                          }

                          const rollbackError = transactionError(
                            error,
                            isSqlError(error) ? error.stage : "unknown",
                            isSqlError(error) ? error.outcome : "unknown",
                          );
                          return resumeCause(
                            resume,
                            Cause.combine(
                              callbackExit.cause,
                              Cause.fail(rollbackError),
                            ),
                          );
                        }

                        if (
                          callbackExit &&
                          Exit.isSuccess(callbackExit) &&
                          isSqlError(error) &&
                          error.stage === "release" &&
                          error.outcome === "commit-confirmed"
                        ) {
                          cleanupFailure = error;
                          return resumeWithCleanupFailure(
                            resume,
                            Effect.succeed(callbackExit.value),
                            error,
                          );
                        }

                        return resume(
                          Effect.fail(
                            transactionError(error, "unknown", "unknown"),
                          ),
                        );
                      },
                    );

                    return Effect.uninterruptible(
                      Effect.promise(() =>
                        complete.then(
                          () => undefined,
                          () => undefined,
                        ),
                      ).pipe(
                        Effect.flatMap(() =>
                          cleanupFailure
                            ? logCleanupFailure(cleanupFailure)
                            : Effect.void,
                        ),
                      ),
                    );
                  }),
                ),
              ),
            )).bind(builder),
        });
        // SAFETY: Object.assign preserves the TransactionBuilder methods, and its
        // replacement execute method has the Effect callback contract above.
        return effectBuilder as EffectTransactionBuilder<DB>;
      };
      return makeBuilder(kyselyTransaction());
    }).bind(kysely),
  });

  Object.defineProperty(kysely, EFFECT_KYSELY_MARKER, {
    configurable: false,
    enumerable: false,
    value: wrapped,
    writable: false,
  });

  return wrapped;
};

type Executable<O> = {
  execute: () => Promise<undefined | O[]>;
} & Compilable<O>;

type ExecutableRaw<O> = {} & Executable<O> & QueryExecutorProvider;

type Query<O> = Executable<O> | RawBuilder<O>;
type QueryRaw<O> = ExecutableRaw<O> | RawBuilder<O>;

const isRawBuilder = <O>(
  query: Executable<O> | RawBuilder<O>,
): query is RawBuilder<O> => {
  return `isRawBuilder` in query && query.isRawBuilder;
};

const queryAsPromise = <DB, O>(
  client: Kysely<DB>,
  query: QueryRaw<O>,
): Promise<QueryResult<O>> => {
  if (isRawBuilder(query)) {
    return query.execute(client);
  }
  const executor = query.getExecutor();
  const compiledQuery = query.compile();
  return executor.executeQuery(compiledQuery);
};

const executeSpan = <DB, TQuery extends Query<unknown> | QueryRaw<unknown>>(
  client: Kysely<DB>,
  query: TQuery,
) => {
  const compiled = isRawBuilder(query)
    ? query.compile(client)
    : query.compile();
  return Effect.withSpan(`kysely.execute`, {
    attributes: {
      sql: compiled.sql,
    },
  });
};

const executeRaw =
  <DB>(client: Kysely<DB>) =>
  <O>(query: QueryRaw<O>) =>
    Effect.tryPromise({
      try: () => queryAsPromise(client, query),
      catch: (cause) => {
        return new SqlError({
          cause,
          message:
            cause instanceof Error
              ? `[executeRaw] SqlError: ${cause.message}\n\n query:\n ${query.compile(client).sql}`
              : `[executeRaw] An error has occurred with the query: ${query.compile(client).sql}`,
        });
      },
    }).pipe(executeSpan(client, query));

// SAFETY: executeSpan only attaches a tracing span (Effect.withSpan) and never
// changes the success or failure channel, so narrowing the piped result back to
// the declared Effect.Effect<O[], SqlError> signature is sound.
const execute =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>): Effect.Effect<O[], SqlError> =>
    Effect.tryPromise({
      try: () =>
        isRawBuilder(query)
          ? queryAsPromise(client, query).then((result) => result.rows)
          : query.execute().then((result) => result ?? []),
      catch: (cause) => {
        return new SqlError({
          cause,
          message:
            cause instanceof Error
              ? `[execute] SqlError: ${cause.message}\n\n query:\n ${query.compile(client).sql}`
              : `[execute] An error has occurred with the query: ${query.compile(client).sql}`,
        });
      },
    }).pipe(executeSpan(client, query)) as Effect.Effect<O[], SqlError>;

const executeTakeFirstOption =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    execute(client)(query).pipe(
      Effect.map((result) => {
        const first = result[0];
        return first === undefined ? Option.none() : Option.some(first);
      }),
    );

const executeTakeFirstOrUndefined =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    executeTakeFirstOption(client)(query).pipe(
      Effect.map((result) => Option.getOrUndefined(result)),
    );

/**
 * An error that occurs when attempting to access the first returned row of a query result that is empty.
 */
export class SqlNoFirstResult extends Schema.TaggedError<SqlNoFirstResult>()(
  "SqlNoFirstResult",
  {},
) {
  override toString(): string {
    return `SqlNoFirstResult: query result is empty, no first row available`;
  }
}

const executeTakeFirstOrError =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    executeTakeFirstOption(client)(query).pipe(
      Effect.flatMap((result) =>
        Option.match(result, {
          onNone: () => Effect.fail(new SqlNoFirstResult()),
          onSome: (value) => Effect.succeed(value),
        }),
      ),
    );
// SAFETY: executeTakeFirstUnsafe is unsafe by contract — the caller guarantees
// the query returns at least one row, so result[0] is a defined value of type O.
const executeTakeFirstUnsafe =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    execute(client)(query).pipe(Effect.map((result) => result[0] as O));
