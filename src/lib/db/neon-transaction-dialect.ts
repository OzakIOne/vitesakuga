// oxlint-disable effecttsgo/async-function -- this module implements Kysely's `Driver` and `DatabaseConnection` interfaces, whose methods must return Promises that Kysely awaits; converting them to Effect would break interface conformance
import {
  Pool as NeonPool,
  type NeonQueryFunction,
  type PoolClient,
} from "@neondatabase/serverless";
import {
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type AbortableOperationOptions,
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from "kysely";

type NeonClient = NeonQueryFunction<false, true>;

type WriteCommand = "INSERT" | "UPDATE" | "DELETE" | "MERGE";

const isWriteCommand = (command: string | undefined): command is WriteCommand =>
  command === "INSERT" ||
  command === "UPDATE" ||
  command === "DELETE" ||
  command === "MERGE";

const numAffectedRows = (
  command: string | undefined,
  rowCount: number | null | undefined,
): bigint | undefined =>
  isWriteCommand(command) ? BigInt(rowCount ?? 0) : undefined;

const toQueryResult = <O>(
  rows: O[],
  command: string | undefined,
  rowCount: number | null | undefined,
): QueryResult<O> => {
  const affected = numAffectedRows(command, rowCount);
  return affected === undefined
    ? { rows }
    : { rows, numAffectedRows: affected };
};

/**
 * Kysely connection backed by the Neon HTTP driver for regular queries and by
 * a fresh WebSocket connection for interactive transactions.
 *
 * Cloudflare Workers forbids reusing I/O (such as WebSockets) created in one
 * request from another request, so a module-level NeonPool singleton breaks
 * after the first request. This connection creates and closes a dedicated
 * WebSocket connection per transaction, entirely within the request that runs
 * it.
 */
class NeonTransactionConnection implements DatabaseConnection {
  readonly #neon: NeonClient;
  readonly #connectionString: string;
  #pool: NeonPool | null = null;
  #client: PoolClient | null = null;

  constructor(neonClient: NeonClient, connectionString: string) {
    this.#neon = neonClient;
    this.#connectionString = connectionString;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const params = [...compiledQuery.parameters];

    if (this.#client) {
      const result = await this.#client.query(compiledQuery.sql, params);
      // SAFETY: pg-style results expose rows as objects matching the compiled query's row type.
      return toQueryResult(result.rows as O[], result.command, result.rowCount);
    }

    const result = await this.#neon.query(compiledQuery.sql, params, {
      fullResults: true,
    });
    // SAFETY: fullResults returns rows as objects matching the compiled query's row type.
    return toQueryResult(result.rows as O[], result.command, result.rowCount);
  }

  streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize: number,
    _options?: AbortableOperationOptions,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("NeonTransactionDialect doesn't support streaming.");
  }

  async beginTransaction(): Promise<void> {
    const pool = new NeonPool({ connectionString: this.#connectionString });
    let client: PoolClient;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw error;
    }
    this.#pool = pool;
    this.#client = client;
  }

  async commitTransaction(): Promise<void> {
    await this.#finish("COMMIT");
  }

  async rollbackTransaction(): Promise<void> {
    await this.#finish("ROLLBACK");
  }

  async #finish(sqlCommand: "COMMIT" | "ROLLBACK"): Promise<void> {
    const client = this.#client;
    const pool = this.#pool;
    this.#client = null;
    this.#pool = null;
    if (!client || !pool) return;
    try {
      await client.query(sqlCommand);
    } finally {
      try {
        client.release();
      } finally {
        await pool.end().catch(() => undefined);
      }
    }
  }
}

class NeonTransactionDriver implements Driver {
  readonly #neon: NeonClient;
  readonly #connectionString: string;
  readonly #connections = new WeakMap<
    DatabaseConnection,
    NeonTransactionConnection
  >();

  constructor(neonClient: NeonClient, connectionString: string) {
    this.#neon = neonClient;
    this.#connectionString = connectionString;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const connection = new NeonTransactionConnection(
      this.#neon,
      this.#connectionString,
    );
    this.#connections.set(connection, connection);
    return connection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    const transactionConnection = this.#connections.get(connection);
    if (!transactionConnection) {
      throw new Error("beginTransaction: unknown connection");
    }
    await transactionConnection.beginTransaction();
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const transactionConnection = this.#connections.get(connection);
    if (!transactionConnection) {
      throw new Error("commitTransaction: unknown connection");
    }
    await transactionConnection.commitTransaction();
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const transactionConnection = this.#connections.get(connection);
    if (!transactionConnection) {
      throw new Error("rollbackTransaction: unknown connection");
    }
    await transactionConnection.rollbackTransaction();
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

/**
 * Kysely dialect for Neon that runs regular queries over HTTP and interactive
 * transactions over a per-transaction WebSocket connection. Cloudflare
 * Workers-compatible because no connection outlives the request that created
 * it.
 */
export class NeonTransactionDialect implements Dialect {
  readonly #config: { neon: NeonClient; connectionString: string };

  constructor(config: { neon: NeonClient; connectionString: string }) {
    this.#config = { ...config };
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  createDriver(): Driver {
    return new NeonTransactionDriver(
      this.#config.neon,
      this.#config.connectionString,
    );
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler();
  }
}
