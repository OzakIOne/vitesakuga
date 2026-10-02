import {
  Cause,
  Context,
  Duration,
  Effect,
  Exit,
  Option,
  Schedule,
  Schema,
  Stream,
} from "effect";
// oxlint-disable effecttsgo/any-unknown-in-error-context -- Kysely callbacks cross an untyped Promise boundary; Effect preserves the caller context and validates rejected values before narrowing.
// oxlint-disable effecttsgo/async-function -- Kysely requires a Promise callback to own the transaction lifecycle.
import {
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  ConstraintError,
  DeadlockError,
  LockTimeoutError,
  SerializationError,
  SqlErrorReason as SqlErrorReasonSchema,
  SqlSyntaxError,
  StatementTimeoutError,
  UniqueViolation,
  UnknownError,
} from "effect/sql/SqlError";
import type { SqlErrorReason } from "effect/sql/SqlError";
import type {
  AbortableQueryOptions,
  AccessMode,
  Compilable,
  IsolationLevel,
  KyselyPlugin,
  Kysely,
  QueryExecutorProvider,
  QueryResult,
  RawBuilder,
  StreamOptions,
  Transaction,
  TransactionBuilder,
} from "kysely";
import { sql } from "kysely";

export type SqlTransactionStage =
  | "begin"
  | "callback"
  | "commit"
  | "rollback"
  | "release"
  | "savepoint"
  | "rollbackToSavepoint"
  | "releaseSavepoint"
  | "unknown";

export type SqlTransactionOutcome =
  | "commit-confirmed"
  | "rollback-confirmed"
  | "not-committed"
  | "unknown";

const SqlTransactionStageSchema = Schema.Literals([
  "begin",
  "callback",
  "commit",
  "rollback",
  "release",
  "savepoint",
  "rollbackToSavepoint",
  "releaseSavepoint",
  "unknown",
]);

const SqlTransactionOutcomeSchema = Schema.Literals([
  "commit-confirmed",
  "rollback-confirmed",
  "not-committed",
  "unknown",
]);

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  cause: Schema.Unknown,
  message: Schema.String,
  operation: Schema.String,
  outcome: Schema.optional(SqlTransactionOutcomeSchema),
  reason: SqlErrorReasonSchema,
  stage: Schema.optional(SqlTransactionStageSchema),
}) {
  get isRetryable() {
    if (this.stage !== undefined) {
      return this.stage === "begin" && this.reason.isRetryable;
    }
    return this.reason.isRetryable;
  }
}

type SqlErrorOptions = {
  readonly operation: string;
  readonly message?: string;
};

type PostgresErrorFields = {
  readonly code?: string | undefined;
  readonly constraint?: string | undefined;
  readonly cause?: unknown;
};

export type SqlFailureCause = Error | PostgresErrorFields;

const PostgresErrorSchema = Schema.Struct({
  code: Schema.optional(Schema.String),
  constraint: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
});

const postgresErrorFields = (
  cause: SqlFailureCause,
): PostgresErrorFields | undefined =>
  Schema.is(PostgresErrorSchema)(cause) ? cause : undefined;

const decodeSqlFailure = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Database drivers reject with unknown values; validate their shape before classification.
  cause: unknown,
): SqlFailureCause => {
  if (cause instanceof Error || Schema.is(PostgresErrorSchema)(cause)) {
    return cause;
  }
  return new Error("Unknown database error", { cause });
};

const postgresCause = (cause: SqlFailureCause) => {
  let current = cause;
  for (let depth = 0; depth < 4; depth++) {
    const fields = postgresErrorFields(current);
    if (fields?.code !== undefined) return { cause: current, fields };
    if (fields?.cause === undefined || fields.cause === current) {
      return { cause: current, fields };
    }
    current = decodeSqlFailure(fields.cause);
  }
  return { cause: current, fields: postgresErrorFields(current) };
};

const classifyPostgresError = (
  originalCause: SqlFailureCause,
  { operation, message }: SqlErrorOptions,
): SqlErrorReason => {
  const parsed = postgresCause(originalCause);
  const code = parsed.fields?.code;
  const fields = { cause: originalCause, operation, message };

  if (code === "23505") {
    const constraint = parsed.fields?.constraint;
    return new UniqueViolation({
      ...fields,
      constraint:
        constraint !== undefined && constraint.length > 0
          ? constraint
          : "unknown",
    });
  }
  if (code?.startsWith("23")) return new ConstraintError(fields);
  if (code === "40P01") return new DeadlockError(fields);
  if (code === "40001") return new SerializationError(fields);
  if (code === "55P03") return new LockTimeoutError(fields);
  if (code === "57014") return new StatementTimeoutError(fields);
  if (code === "42601") return new SqlSyntaxError(fields);
  if (code === "28P01") return new AuthenticationError(fields);
  if (code === "42501") return new AuthorizationError(fields);
  if (code?.startsWith("08")) return new ConnectionError(fields);
  return new UnknownError(fields);
};

export const makeSqlError = <Cause>(options: {
  readonly cause: Cause;
  readonly operation: string;
  readonly message?: string;
  readonly outcome?: SqlTransactionOutcome;
  readonly stage?: SqlTransactionStage;
}) => {
  const cause = decodeSqlFailure(options.cause);
  const reason = classifyPostgresError(cause, options);
  return new SqlError({
    cause,
    message: options.message ?? reason.message ?? reason._tag,
    operation: options.operation,
    outcome: options.outcome,
    reason,
    stage: options.stage,
  });
};

export type SqlTransactionError = SqlError & {
  readonly operation: string;
  readonly stage: SqlTransactionStage;
  readonly outcome: SqlTransactionOutcome;
};

export type DatabaseError = SqlError;

export const makeSqlTransactionError = <Cause>(options: {
  readonly cause: Cause;
  readonly stage: SqlTransactionStage;
  readonly outcome: SqlTransactionOutcome;
}) => {
  const transactionCause = decodeSqlFailure(options.cause);
  const operation = `transaction:${options.stage}`;
  const detail =
    transactionCause instanceof Error
      ? transactionCause.message
      : "An error occurred while managing a transaction";
  const message = `[${operation}] SqlError: ${detail}`;
  return Object.assign(
    makeSqlError({
      cause: transactionCause,
      message,
      operation,
      outcome: options.outcome,
      stage: options.stage,
    }),
    { outcome: options.outcome, stage: options.stage },
  );
};

export type TransactionRetryPolicy = {
  readonly maxRetries: number;
  readonly backoff?: Duration.Input;
};

export type TransactionOptions = {
  readonly accessMode?: AccessMode;
  readonly isolationLevel?: IsolationLevel;
  readonly retry?: TransactionRetryPolicy;
};

type Executable<O> = {
  execute: (options?: AbortableQueryOptions) => Promise<undefined | O[]>;
} & Compilable<O>;

type ExecutableRaw<O> = Executable<O> & QueryExecutorProvider;
type Query<O> = Executable<O> | RawBuilder<O>;
type QueryRaw<O> = ExecutableRaw<O> | RawBuilder<O>;

type Streamable<O> = Compilable<O> & {
  stream: (options?: StreamOptions | number) => AsyncIterableIterator<O>;
};

type AfterCommitEffect = Effect.Effect<void, never, never>;

const transactionAdapterPlugin: KyselyPlugin = {
  transformQuery: ({ node }) => node,
  transformResult: ({ result }) => Promise.resolve(result),
};

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
  executeTakeFirstOrDie: <O>(query: Query<O>) => Effect.Effect<O, SqlError>;
  stream: <O>(
    query: Streamable<O>,
    options?: StreamOptions | number,
  ) => Stream.Stream<O, SqlError>;
};

export type EffectTransaction<DB> = Omit<
  Transaction<DB>,
  "connection" | "destroy" | "executeQuery" | "startTransaction" | "transaction"
> &
  EffectExecutor & {
    savepoint: <A, E, R>(
      label: string,
      f: (trx: EffectTransaction<DB>) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | DatabaseError, R>;
    afterCommit: (effect: AfterCommitEffect) => Effect.Effect<void>;
  };

export type EffectKysely<DB> = Omit<
  Kysely<DB>,
  "connection" | "executeQuery" | "startTransaction" | "transaction"
> &
  EffectExecutor & {
    transaction: <A, E, R>(
      optionsOrUse: TransactionOptions | TransactionCallback<DB, A, E, R>,
      use?: TransactionCallback<DB, A, E, R>,
    ) => Effect.Effect<A, E | DatabaseError, R>;
  };

type TransactionFrame<DB> = {
  readonly transaction: Transaction<DB>;
  readonly hooks: AfterCommitEffect[];
  readonly counter: { value: number };
};

type TransactionCallback<DB, A, E, R> = (
  trx: EffectTransaction<DB>,
) => Effect.Effect<A, E, R>;

let databaseInstanceId = 0;

const EFFECT_KYSELY_MARKER = Symbol("vitesakuga.effectKysely");

type MarkedKysely<DB> = Kysely<DB> & {
  readonly [EFFECT_KYSELY_MARKER]: EffectKysely<DB>;
};

const isMarkedKysely = <DB>(kysely: Kysely<DB>): kysely is MarkedKysely<DB> =>
  EFFECT_KYSELY_MARKER in kysely;

const isRawBuilder = <O>(
  query: Compilable<O> | RawBuilder<O>,
): query is RawBuilder<O> => "isRawBuilder" in query && query.isRawBuilder;

const compileQuery = <DB>(
  client: Kysely<DB>,
  query: Query<unknown> | QueryRaw<unknown> | Streamable<unknown>,
) => (isRawBuilder(query) ? query.compile(client) : query.compile());

const isSqlError = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Driver rejections are validated by the error schema.
  error: unknown,
): error is SqlError => Schema.is(SqlError)(error);

const queryError = <DB>(
  client: Kysely<DB>,
  query: Query<unknown> | QueryRaw<unknown> | Streamable<unknown>,
  operation: string,
  cause: unknown,
) => {
  if (isSqlError(cause)) return cause;
  const failure = decodeSqlFailure(cause);
  const detail =
    failure instanceof Error ? failure.message : "Unknown database error";
  return makeSqlError({
    cause: failure,
    operation,
    message: `[${operation}] SqlError: ${detail}\n\nquery:\n${compileQuery(client, query).sql}`,
  });
};

const executeSpan = <DB>(
  client: Kysely<DB>,
  query: Query<unknown> | QueryRaw<unknown> | Streamable<unknown>,
  operation: string,
) =>
  Effect.withSpan(
    `kysely.${operation}`,
    {
      kind: "client",
      attributes: { "db.query.text": compileQuery(client, query).sql },
    },
    { captureStackTrace: false },
  );

const executeRaw =
  <DB>(client: Kysely<DB>) =>
  <O>(query: QueryRaw<O>) =>
    Effect.tryPromise({
      try: (signal) =>
        isRawBuilder(query)
          ? query.execute(client, { signal })
          : query.execute({ signal }).then((rows) => ({ rows: rows ?? [] })),
      catch: (cause) => queryError(client, query, "executeRaw", cause),
    }).pipe(executeSpan(client, query, "executeRaw"));

const executeOperation =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>, operation: string) =>
    Effect.tryPromise({
      try: (signal) =>
        isRawBuilder(query)
          ? query.execute(client, { signal }).then((result) => result.rows)
          : query.execute({ signal }).then((rows) => rows ?? []),
      catch: (cause) => queryError(client, query, operation, cause),
    }).pipe(executeSpan(client, query, operation));

const execute =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    executeOperation(client)(query, "execute");

const executeTakeFirstOption =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    execute(client)(query).pipe(
      Effect.map((rows) => {
        const first = rows[0];
        return first === undefined ? Option.none() : Option.some(first);
      }),
    );

const executeTakeFirstOrUndefined =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    execute(client)(query).pipe(Effect.map((rows) => rows[0]));

export class SqlNoFirstResult extends Schema.TaggedError<SqlNoFirstResult>()(
  "SqlNoFirstResult",
  {},
) {}

const executeTakeFirstOrError =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    executeTakeFirstOrUndefined(client)(query).pipe(
      Effect.flatMap((first) =>
        first === undefined
          ? Effect.fail(new SqlNoFirstResult())
          : Effect.succeed(first),
      ),
    );

const executeTakeFirstOrDie =
  <DB>(client: Kysely<DB>) =>
  <O>(query: Query<O>) =>
    executeTakeFirstOrError(client)(query).pipe(
      Effect.catchTag("SqlNoFirstResult", Effect.die),
    );

const stream =
  <DB>(client: Kysely<DB>) =>
  <O>(
    query: Streamable<O>,
    options?: StreamOptions | number,
  ): Stream.Stream<O, SqlError> =>
    Stream.suspend(() =>
      Stream.fromAsyncIterable(query.stream(options), (cause) =>
        queryError(client, query, "stream", cause),
      ),
    ).pipe(
      Stream.withSpan("kysely.stream", {
        kind: "client",
        attributes: { "db.query.text": compileQuery(client, query).sql },
      }),
    );

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
    executeTakeFirstOrDie: <O>(query: Query<O>) =>
      protect(executeTakeFirstOrDie(client)(query)),
    stream: <O>(query: Streamable<O>, options?: StreamOptions | number) =>
      stream(client)(query, options),
  };
};

class TransactionCallbackFailure<E> {
  readonly _tag = "TransactionCallbackFailure";

  constructor(readonly cause: Cause.Cause<E>) {}
}

const isTransactionCallbackFailure = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Promise rejection values cross Kysely's untyped transaction callback boundary.
  error: unknown,
): error is TransactionCallbackFailure<unknown> =>
  error instanceof TransactionCallbackFailure;

const isSqlTransactionError = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Kysely rejects with an untyped Promise value.
  error: unknown,
): error is SqlTransactionError =>
  isSqlError(error) && error.stage !== undefined && error.outcome !== undefined;

const isTransactionCallback = <DB, A, E, R>(
  optionsOrUse: TransactionOptions | TransactionCallback<DB, A, E, R>,
): optionsOrUse is TransactionCallback<DB, A, E, R> =>
  typeof optionsOrUse === "function";

const transactionError = (
  cause: unknown,
  stage: SqlTransactionStage = "unknown",
  outcome: SqlTransactionOutcome = "unknown",
): DatabaseError => {
  if (isSqlError(cause)) return cause;
  return makeSqlTransactionError({
    cause: decodeSqlFailure(cause),
    stage,
    outcome,
  });
};

const logCleanupFailure = (error: DatabaseError) =>
  Effect.logWarning("Kysely transaction cleanup failed", error);

const resumeWithCleanupFailure = <A, E>(
  resume: (effect: Effect.Effect<A, E>) => void,
  effect: Effect.Effect<A, E>,
  cleanupFailure?: DatabaseError,
) =>
  resume(
    cleanupFailure
      ? logCleanupFailure(cleanupFailure).pipe(Effect.flatMap(() => effect))
      : effect,
  );

const resumeCause = <A, E, C>(
  resume: (effect: Effect.Effect<A, E>) => void,
  cause: Cause.Cause<C>,
  cleanupFailure?: DatabaseError,
) => {
  // SAFETY: replay the callback's original Cause unchanged into its declared E | SqlError channel.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- Effect.callback's generic error channel is wider than the runtime Cause captured from that callback.
  const failure = Effect.failCause(cause) as unknown as Effect.Effect<A, E>;
  return resumeWithCleanupFailure(resume, failure, cleanupFailure);
};

const isRetryableSqlError = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Effect retry examines values from the typed error channel.
  error: unknown,
): error is DatabaseError => {
  if (isSqlTransactionError(error)) {
    return error.stage === "begin" && error.reason.isRetryable;
  }
  return isSqlError(error) && error.isRetryable;
};

const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  retry: TransactionRetryPolicy | undefined,
): Effect.Effect<A, E, R> => {
  if (retry === undefined || retry.maxRetries <= 0) return effect;
  if (retry.backoff === undefined) {
    return Effect.retry(effect, {
      times: retry.maxRetries,
      while: isRetryableSqlError,
    });
  }
  const schedule = Schedule.exponential(retry.backoff).pipe(
    Schedule.upTo({ times: retry.maxRetries }),
  );
  return Effect.retry(effect, { schedule, while: isRetryableSqlError });
};

const quoteSavepoint = (name: string) => `"${name.replaceAll('"', '""')}"`;

const runSavepointStatement = <DB>(
  transaction: Transaction<DB>,
  operation: string,
  statement: string,
) =>
  executeOperation(transaction)(sql.raw(statement), operation).pipe(
    Effect.asVoid,
  );

const makeEffectTransaction = <DB>(
  frame: TransactionFrame<DB>,
  currentTransaction: Context.Reference<TransactionFrame<DB> | undefined>,
): EffectTransaction<DB> => {
  const transaction = frame.transaction.withPlugin(transactionAdapterPlugin);
  return Object.assign(transaction, makeExecutor(transaction, true), {
    savepoint: <A, E, R>(
      label: string,
      f: (trx: EffectTransaction<DB>) => Effect.Effect<A, E, R>,
    ) => runSavepoint(frame, currentTransaction, label, f),
    afterCommit: (effect: AfterCommitEffect) =>
      Effect.sync(() => {
        frame.hooks.push(effect);
      }),
  });
};

const runSavepoint = <DB, A, E, R>(
  parent: TransactionFrame<DB>,
  currentTransaction: Context.Reference<TransactionFrame<DB> | undefined>,
  label: string,
  f: (trx: EffectTransaction<DB>) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | DatabaseError, R> => {
  const name = `effect_sp_${++parent.counter.value}`;
  const identifier = quoteSavepoint(name);
  const childFrame: TransactionFrame<DB> = {
    counter: parent.counter,
    hooks: [],
    transaction: parent.transaction,
  };

  return Effect.acquireUseRelease(
    runSavepointStatement(
      parent.transaction,
      "savepoint",
      `SAVEPOINT ${identifier}`,
    ).pipe(Effect.as(childFrame)),
    (child) =>
      f(makeEffectTransaction(child, currentTransaction)).pipe(
        Effect.provideService(currentTransaction, child),
        Effect.map((value) => ({ value, hooks: child.hooks })),
      ),
    (_child, exit) => {
      if (Exit.isSuccess(exit)) {
        return runSavepointStatement(
          parent.transaction,
          "releaseSavepoint",
          `RELEASE SAVEPOINT ${identifier}`,
        );
      }
      return runSavepointStatement(
        parent.transaction,
        "rollbackToSavepoint",
        `ROLLBACK TO SAVEPOINT ${identifier}`,
      ).pipe(
        Effect.andThen(
          runSavepointStatement(
            parent.transaction,
            "releaseSavepoint",
            `RELEASE SAVEPOINT ${identifier}`,
          ),
        ),
      );
    },
  ).pipe(
    Effect.tap(({ hooks }) => Effect.sync(() => parent.hooks.push(...hooks))),
    Effect.map(({ value }) => value),
    Effect.withSpan(
      `kysely.savepoint:${label}`,
      {},
      { captureStackTrace: false },
    ),
  );
};

const runKyselyTransaction = <DB, A, E, R>(
  builder: TransactionBuilder<DB>,
  currentTransaction: Context.Reference<TransactionFrame<DB> | undefined>,
  use: (trx: EffectTransaction<DB>) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | DatabaseError, R> =>
  Effect.contextWith((context) =>
    Effect.flatMap(Effect.option(Effect.currentSpan), (parentSpan) =>
      Effect.callback<A, E | DatabaseError>((resume, signal) => {
        let callbackExit: Exit.Exit<A, E> | undefined;
        let transactionFrame: TransactionFrame<DB> | undefined;
        let cleanupFailure: DatabaseError | undefined;

        const complete = builder.execute(async (transaction) => {
          const frame: TransactionFrame<DB> = {
            counter: { value: 0 },
            hooks: [],
            transaction,
          };
          transactionFrame = frame;
          const callback = Effect.suspend(() =>
            signal.aborted
              ? Effect.interrupt
              : use(makeEffectTransaction(frame, currentTransaction)),
          ).pipe(Effect.provideService(currentTransaction, frame));
          const contextualCallback = Option.match(parentSpan, {
            onNone: () => callback,
            onSome: (span) => Effect.withParentSpan(callback, span),
          });
          callbackExit = await Effect.runPromiseExitWith(context)(
            contextualCallback,
            { signal },
          );
          if (Exit.isFailure(callbackExit)) {
            throw new TransactionCallbackFailure(callbackExit.cause);
          }
          return callbackExit.value;
        });

        const resumeAfterCommit = (value: A, failure?: DatabaseError) => {
          const hooks = transactionFrame?.hooks ?? [];
          const afterCommit = Effect.uninterruptible(
            Effect.forEach(hooks, (hook) => hook, { discard: true }),
          ).pipe(Effect.as(value));
          resumeWithCleanupFailure(resume, afterCommit, failure);
        };

        void complete.then(
          (value) => resumeAfterCommit(value),
          // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Kysely rejects with Promise values that need runtime classification.
          (error: unknown) => {
            if (callbackExit && Exit.isFailure(callbackExit)) {
              if (
                isSqlTransactionError(error) &&
                error.stage === "release" &&
                error.outcome === "rollback-confirmed"
              ) {
                cleanupFailure = error;
                return resumeCause(resume, callbackExit.cause, error);
              }

              if (isTransactionCallbackFailure(error)) {
                return resumeCause(resume, error.cause);
              }

              const rollbackError = transactionError(
                error,
                isSqlTransactionError(error) ? error.stage : "unknown",
                isSqlTransactionError(error) ? error.outcome : "unknown",
              );
              return resumeCause(
                resume,
                Cause.combine(callbackExit.cause, Cause.fail(rollbackError)),
              );
            }

            if (
              callbackExit &&
              Exit.isSuccess(callbackExit) &&
              isSqlTransactionError(error) &&
              error.stage === "release" &&
              error.outcome === "commit-confirmed"
            ) {
              cleanupFailure = error;
              return resumeAfterCommit(callbackExit.value, error);
            }

            return resume(
              Effect.fail(transactionError(error, "unknown", "unknown")),
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
              cleanupFailure ? logCleanupFailure(cleanupFailure) : Effect.void,
            ),
          ),
        );
      }),
    ),
  );

const configureTransaction = <DB>(
  builder: TransactionBuilder<DB>,
  options: TransactionOptions,
) => {
  let configured = builder;
  if (options.accessMode !== undefined) {
    configured = configured.setAccessMode(options.accessMode);
  }
  if (options.isolationLevel !== undefined) {
    configured = configured.setIsolationLevel(options.isolationLevel);
  }
  return configured;
};

export const makeFromKysely = <DB>(kysely: Kysely<DB>): EffectKysely<DB> => {
  if (isMarkedKysely(kysely)) return kysely[EFFECT_KYSELY_MARKER];
  const createTransactionBuilder = kysely.transaction.bind(kysely);

  const currentTransaction = Context.Reference<
    TransactionFrame<DB> | undefined
  >(`vitesakuga/kysely/current-transaction/${databaseInstanceId++}`, {
    defaultValue: () => undefined,
  });

  const transaction: EffectKysely<DB>["transaction"] = <A, E, R>(
    optionsOrUse: TransactionOptions | TransactionCallback<DB, A, E, R>,
    use?: TransactionCallback<DB, A, E, R>,
  ): Effect.Effect<A, E | DatabaseError, R> => {
    const options: TransactionOptions = isTransactionCallback<DB, A, E, R>(
      optionsOrUse,
    )
      ? {}
      : optionsOrUse;
    const callback = isTransactionCallback<DB, A, E, R>(optionsOrUse)
      ? optionsOrUse
      : use;
    if (callback === undefined) {
      return Effect.die(new Error("A transaction callback is required"));
    }

    return Effect.flatMap(currentTransaction, (active) => {
      if (active !== undefined) {
        if (
          options.accessMode !== undefined ||
          options.isolationLevel !== undefined ||
          options.retry !== undefined
        ) {
          return Effect.fail(
            makeSqlError({
              cause: new Error(
                "Nested transactions cannot set transaction options",
              ),
              message: "Nested transactions cannot set transaction options",
              operation: "nestedTransaction",
            }),
          );
        }
        return runSavepoint(
          active,
          currentTransaction,
          "nested-transaction",
          callback,
        );
      }

      const builder = configureTransaction(createTransactionBuilder(), options);
      return withRetry(
        runKyselyTransaction(builder, currentTransaction, callback),
        options.retry,
      );
    });
  };

  const wrapped: EffectKysely<DB> = Object.assign(kysely, {
    ...makeExecutor(kysely),
    transaction,
  });

  Object.defineProperty(kysely, EFFECT_KYSELY_MARKER, {
    configurable: false,
    enumerable: false,
    value: wrapped,
    writable: false,
  });

  return wrapped;
};
