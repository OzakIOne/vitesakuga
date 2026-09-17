// oxlint-disable effecttsgo/async-function -- this module implements Kysely's `Driver` and `DatabaseConnection` interfaces, whose methods must return Promises that Kysely awaits; converting them to Effect would break interface conformance
import type { PGlite } from "@electric-sql/pglite";
import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  validateTransactionSettings,
} from "kysely";
import type {
  DatabaseConnection,
  Dialect,
  Driver,
  Kysely,
  QueryCompiler,
  QueryResult,
  TransactionSettings,
} from "kysely";

import { SqlError, type SqlTransactionOutcome } from "../effect/effect.utils";

type TransactionHook = () => void | Promise<void>;

export type PGliteDriverHooks = {
  /** Targeted fault injection for transaction-driver tests. */
  readonly executeQuery?: (
    compiledQuery: CompiledQuery,
  ) => void | Promise<void>;
  readonly beginTransaction?: TransactionHook;
  readonly commitTransaction?: TransactionHook;
  readonly rollbackTransaction?: TransactionHook;
  readonly releaseConnection?: (
    outcome: SqlTransactionOutcome | undefined,
  ) => void | Promise<void>;
};

type TransactionState = {
  commitAttempted: boolean;
  outcome: SqlTransactionOutcome;
};

const makeTransactionError = (
  cause: unknown,
  stage: "begin" | "commit" | "rollback" | "release",
  outcome: SqlTransactionOutcome,
) =>
  new SqlError({
    cause,
    message: `[transaction:${stage}] ${
      cause instanceof Error ? cause.message : String(cause)
    }`,
    outcome,
    stage,
  });

class PGliteConnection implements DatabaseConnection {
  constructor(
    private pg: PGlite,
    private executeQueryHook?: PGliteDriverHooks["executeQuery"],
  ) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    await this.executeQueryHook?.(compiledQuery);
    const result = await this.pg.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    // SAFETY: PGlite returns rows as plain objects shaped like the compiled query's row
    // type R, and affectedRows mirrors pg's rowCount, so the cast to QueryResult<R> holds.
    return {
      numAffectedRows:
        result.affectedRows != null ? BigInt(result.affectedRows) : undefined,
      rows: (result.rows as R[]) ?? [],
    } as QueryResult<R>;
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming not supported in PGlite test driver");
  }
}

class PGliteDriver implements Driver {
  #pg: PGlite;
  #hooks: PGliteDriverHooks;
  #connection: PGliteConnection | null = null;
  #available: Promise<void> = Promise.resolve();
  #release: (() => void) | undefined;
  #transactions = new WeakMap<DatabaseConnection, TransactionState>();

  constructor(pg: PGlite, hooks: PGliteDriverHooks = {}) {
    this.#pg = pg;
    this.#hooks = hooks;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    // A transaction owns the single connection until commit/rollback. Other
    // queries must wait rather than accidentally joining its transaction.
    const previous = this.#available;
    const next = Promise.withResolvers<void>();
    this.#available = next.promise;
    await previous;
    this.#release = next.resolve;
    if (!this.#connection) {
      this.#connection = new PGliteConnection(
        this.#pg,
        this.#hooks.executeQuery,
      );
    }
    return this.#connection;
  }

  async beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    try {
      validateTransactionSettings(settings);
      const state: TransactionState = {
        commitAttempted: false,
        outcome: "unknown",
      };
      this.#transactions.set(connection, state);
      await this.#hooks.beginTransaction?.();
      await this.#pg.query("BEGIN");
      state.outcome = "not-committed";
    } catch (cause) {
      const state = this.#transactions.get(connection);
      if (state) {
        state.outcome = "unknown";
      }
      throw makeTransactionError(cause, "begin", "unknown");
    }
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const state = this.#transactions.get(connection);
    if (state) {
      state.commitAttempted = true;
    }
    try {
      await this.#hooks.commitTransaction?.();
      await this.#pg.query("COMMIT");
      if (state) {
        state.outcome = "commit-confirmed";
      }
    } catch (cause) {
      if (state) {
        state.outcome = "unknown";
      }
      throw makeTransactionError(cause, "commit", "unknown");
    }
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const state = this.#transactions.get(connection);
    try {
      await this.#hooks.rollbackTransaction?.();
      await this.#pg.query("ROLLBACK");
      if (state) {
        // A rejected COMMIT may have reached the server. A subsequent
        // successful ROLLBACK cannot prove that the commit was absent.
        state.outcome = state.commitAttempted
          ? "unknown"
          : "rollback-confirmed";
      }
    } catch (cause) {
      if (state) {
        state.outcome = "unknown";
      }
      throw makeTransactionError(cause, "rollback", "unknown");
    }
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const release = this.#release;
    const outcome = this.#transactions.get(connection)?.outcome;
    this.#release = undefined;
    try {
      await this.#hooks.releaseConnection?.(outcome);
    } catch (cause) {
      throw makeTransactionError(cause, "release", outcome ?? "unknown");
    } finally {
      // Re-open the single-connection gate only after release cleanup has
      // settled, even when that cleanup rejects.
      release?.();
      this.#transactions.delete(connection);
    }
  }

  async destroy(): Promise<void> {
    await this.#pg.close();
  }
}

export class PGliteDialect implements Dialect {
  #pg: PGlite;
  #hooks: PGliteDriverHooks;

  constructor(pg: PGlite, hooks: PGliteDriverHooks = {}) {
    this.#pg = pg;
    this.#hooks = hooks;
  }

  createDriver(): Driver {
    return new PGliteDriver(this.#pg, this.#hooks);
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler();
  }

  createAdapter() {
    return new PostgresAdapter();
  }

  createIntrospector(db: Kysely<unknown>) {
    return new PostgresIntrospector(db);
  }
}
