import { assertEquals } from "@std/assert";
import type { DatabasePool } from "../src/db/client.ts";
import { bootstrapWorkspace } from "../src/db/workspace.ts";

Deno.test("workspace bootstrap is an owner-id upsert", async () => {
  let values: unknown[] = [];
  const database = {
    query: (_text: string, parameters: unknown[]) => {
      values = parameters;
      return Promise.resolve({
        rows: [{ id: "workspace", owner_discord_user_id: "owner", name: "Fuscabot" }],
      });
    },
  } as unknown as DatabasePool;
  const workspace = await bootstrapWorkspace(database, "owner");
  assertEquals(values, ["Fuscabot", "owner"]);
  assertEquals(workspace.id, "workspace");
});
