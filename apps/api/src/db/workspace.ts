import type { DatabasePool } from "./client.ts";

export type Workspace = { id: string; ownerDiscordUserId: string; name: string };

/** Creates the private v1 workspace once and returns its stable identity. */
export async function bootstrapWorkspace(
  database: DatabasePool,
  ownerDiscordUserId: string,
  name = "Fuscabot",
): Promise<Workspace> {
  const result = await database.query<{
    id: string;
    owner_discord_user_id: string;
    name: string;
  }>(
    `INSERT INTO workspaces (name, owner_discord_user_id)
     VALUES ($1, $2)
     ON CONFLICT (owner_discord_user_id) DO UPDATE SET updated_at = workspaces.updated_at
     RETURNING id, owner_discord_user_id, name`,
    [name, ownerDiscordUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Workspace bootstrap returned no row");
  return { id: row.id, ownerDiscordUserId: row.owner_discord_user_id, name: row.name };
}
