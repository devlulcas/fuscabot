import { createDatabasePool } from "./client.ts";
import { type MigrationSource, runMigrations } from "./migrations.ts";

export async function loadMigrations(directory: URL): Promise<MigrationSource[]> {
  const migrations: MigrationSource[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      migrations.push({
        name: entry.name,
        sql: await Deno.readTextFile(new URL(entry.name, directory)),
      });
    }
  }
  return migrations;
}

if (import.meta.main) {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = createDatabasePool(databaseUrl);
  try {
    const applied = await runMigrations(
      pool,
      await loadMigrations(new URL("../../migrations/", import.meta.url)),
    );
    console.log(
      applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database is up to date",
    );
  } finally {
    await pool.end();
  }
}
