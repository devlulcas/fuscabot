import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

export type DatabasePool = Pick<Pool, "connect" | "end" | "query">;
export type DatabaseClient = Pick<PoolClient, "query" | "release">;
export type AppDatabase = NodePgDatabase<typeof schema>;

/** Constructs a lazy pool. No network request occurs until the first query. */
export function createDatabasePool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
}

export function createAppDatabase(pool: Pool): AppDatabase {
  return drizzle(pool, { schema });
}
