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

class PGliteConnection implements DatabaseConnection {
  constructor(private pg: PGlite) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.pg.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
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
  #connection: PGliteConnection | null = null;

  constructor(pg: PGlite) {
    this.#pg = pg;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    if (!this.#connection) {
      this.#connection = new PGliteConnection(this.#pg);
    }
    return this.#connection;
  }

  async beginTransaction(
    _connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    validateTransactionSettings(settings);
    await this.#pg.query("BEGIN");
  }

  async commitTransaction(_connection: DatabaseConnection): Promise<void> {
    await this.#pg.query("COMMIT");
  }

  async rollbackTransaction(_connection: DatabaseConnection): Promise<void> {
    await this.#pg.query("ROLLBACK");
  }

  async releaseConnection(_connection: DatabaseConnection): Promise<void> {
    // PGlite is single-connection; no-op
  }

  async destroy(): Promise<void> {
    await this.#pg.close();
  }
}

export class PGliteDialect implements Dialect {
  #pg: PGlite;

  constructor(pg: PGlite) {
    this.#pg = pg;
  }

  createDriver(): Driver {
    return new PGliteDriver(this.#pg);
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
