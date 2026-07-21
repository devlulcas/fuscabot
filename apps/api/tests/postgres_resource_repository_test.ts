import { assertEquals } from "@std/assert";
import type { DatabasePool } from "../src/db/client.ts";
import { PostgresResourceRepository } from "../src/repositories/postgres_resource_repository.ts";

Deno.test("Postgres resource lookup always scopes by workspace", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const database = {
    query: (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  } as unknown as DatabasePool;
  const repository = new PostgresResourceRepository(database);
  await repository.findById("workspace-a", "resource-a");
  await repository.update("workspace-a", "resource-a", { title: "Updated" });
  await repository.delete("workspace-a", "resource-a");
  assertEquals(calls.every((call) => call.text.includes("workspace_id")), true);
  assertEquals(calls.every((call) => call.values[0] === "workspace-a"), true);
});

Deno.test("Postgres resource search includes bilingual tag labels and aliases", async () => {
  let statement = "";
  const database = {
    query: (text: string) => {
      statement = text;
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  } as unknown as DatabasePool;
  await new PostgresResourceRepository(database).list("workspace-a", {
    search: "arquitetura",
    limit: 25,
    offset: 0,
  });
  assertEquals(statement.includes("tag_labels"), true);
  assertEquals(statement.includes("tag_aliases"), true);
});

Deno.test("Postgres bulk actions lock ownership and commit one workspace-scoped update", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const ids = [
    "019432f0-7c00-7000-8000-000000000001",
    "019432f0-7c00-7000-8000-000000000002",
  ];
  const client = {
    query: (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return Promise.resolve({
        rows: text.startsWith("SELECT id") ? ids.map((id) => ({ id })) : [],
        rowCount: text.startsWith("UPDATE") ? ids.length : 0,
      });
    },
    release: () => undefined,
  };
  const database = {
    connect: () => Promise.resolve(client),
  } as unknown as DatabasePool;
  assertEquals(
    await new PostgresResourceRepository(database).bulkAction("workspace-a", ids, "archive"),
    ids,
  );
  assertEquals(calls.some((call) => call.text.includes("FOR UPDATE")), true);
  assertEquals(calls.some((call) => call.text.startsWith("UPDATE resources")), true);
  assertEquals(calls.at(-1)?.text, "COMMIT");
  assertEquals(
    calls.filter((call) => call.values.length).every((call) => call.values[0] === "workspace-a"),
    true,
  );
});
