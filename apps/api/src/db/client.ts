import { Pool, type PoolClient } from "pg";

export type DatabasePool = Pick<Pool, "connect" | "end" | "query">;
export type DatabaseClient = Pick<PoolClient, "query" | "release">;

/** Constructs a lazy pool. No network request occurs until the first query. */
export function createDatabasePool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
}
