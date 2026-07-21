import type { AppDatabase } from "./client.ts";
import { workspaces } from "./schema.ts";

export type Workspace = { id: string; ownerDiscordUserId: string; name: string };

/** Creates the private v1 workspace once and returns its stable identity. */
export async function bootstrapWorkspace(
  database: AppDatabase,
  ownerDiscordUserId: string,
  name = "Fuscabot",
): Promise<Workspace> {
  const [row] = await database.insert(workspaces).values({ name, ownerDiscordUserId })
    .onConflictDoUpdate({
      target: workspaces.ownerDiscordUserId,
      set: { updatedAt: new Date() },
    }).returning({
      id: workspaces.id,
      ownerDiscordUserId: workspaces.ownerDiscordUserId,
      name: workspaces.name,
    });
  if (!row) throw new Error("Workspace bootstrap returned no row");
  return row;
}
