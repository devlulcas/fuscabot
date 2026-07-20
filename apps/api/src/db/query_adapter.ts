import type { Pool } from "pg";
import type {
  QueryExecutor,
  TransactionalQuery,
} from "../repositories/discord_setup_repository.ts";

export function queryAdapter(pool: Pool): TransactionalQuery {
  return {
    async queryObject<T>(sql: string, args: unknown[] = []) {
      const result = await pool.query(sql, args);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(work: (sql: QueryExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work({
          async queryObject<R>(sql: string, args: unknown[] = []) {
            const query = await client.query(sql, args);
            return { rows: query.rows as R[] };
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (cause) {
        await client.query("ROLLBACK");
        throw cause;
      } finally {
        client.release();
      }
    },
  };
}
