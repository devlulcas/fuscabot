import type { DatabasePool } from "./client.ts";

export type MigrationSource = { name: string; sql: string };

export async function runMigrations(
  database: DatabasePool,
  migrations: readonly MigrationSource[],
): Promise<string[]> {
  const client = await database.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('fuscabot:migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const migration of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
      const checksum = await sha256(migration.sql);
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [migration.name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration changed: ${migration.name}`);
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          migration.name,
          checksum,
        ]);
        await client.query("COMMIT");
        applied.push(migration.name);
      } catch (cause) {
        await client.query("ROLLBACK");
        throw cause;
      }
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('fuscabot:migrations'))").catch(
      () => {},
    );
    client.release();
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
