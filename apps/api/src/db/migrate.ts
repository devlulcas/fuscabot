import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createAppDatabase, createDatabasePool } from "./client.ts";

if (import.meta.main) {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = createDatabasePool(databaseUrl);
  try {
    await migrate(createAppDatabase(pool), { migrationsFolder: "./drizzle" });
    console.log("Database migrations are up to date");
  } finally {
    await pool.end();
  }
}
