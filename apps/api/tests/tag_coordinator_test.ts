import { assertEquals, assertRejects } from "@std/assert";
import type { AppDatabase } from "../src/db/client.ts";
import { PostgresTagCoordinator, TagNotFoundError } from "../src/services/tag_coordinator.ts";

Deno.test("tag update stops before child writes when the tag belongs to another workspace", async () => {
  let writes = 0;
  const tx = {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => {
            writes++;
            return Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: () => {
      writes++;
      throw new Error("child write must not run");
    },
    delete: () => {
      writes++;
      throw new Error("child write must not run");
    },
  };
  const database = {
    transaction: <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx),
  } as unknown as AppDatabase;
  const coordinator = new PostgresTagCoordinator(
    "owner",
    "019432f0-7c00-7000-8000-000000000001",
    database,
  );
  await assertRejects(
    () =>
      coordinator.update("owner", "019432f0-7c00-7000-8000-000000000002", {
        slug: "foreign",
        english: "Foreign",
        portuguese: "Externo",
        aliases: ["outside"],
      }),
    TagNotFoundError,
  );
  assertEquals(writes, 1);
});
