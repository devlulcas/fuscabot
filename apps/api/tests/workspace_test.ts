import { assertEquals } from "@std/assert";
import type { AppDatabase } from "../src/db/client.ts";
import { bootstrapWorkspace } from "../src/db/workspace.ts";

Deno.test("workspace bootstrap is an owner-id upsert", async () => {
  let values: unknown;
  const database = {
    insert: () => ({
      values: (input: unknown) => {
        values = input;
        return {
          onConflictDoUpdate: () => ({
            returning: () =>
              Promise.resolve([{ id: "workspace", ownerDiscordUserId: "owner", name: "Fuscabot" }]),
          }),
        };
      },
    }),
  } as unknown as AppDatabase;
  const workspace = await bootstrapWorkspace(database, "owner");
  assertEquals(values, { name: "Fuscabot", ownerDiscordUserId: "owner" });
  assertEquals(workspace.id, "workspace");
});
