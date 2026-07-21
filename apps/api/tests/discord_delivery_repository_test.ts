import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import type { AppDatabase } from "../src/db/client.ts";
import { DeliveryConflictError } from "../src/domain/durable_delivery.ts";
import { PostgresDurableDeliveryRepository } from "../src/repositories/durable_delivery_repository.ts";

const setupSource = await Deno.readTextFile(
  new URL("../src/repositories/discord_setup_repository.ts", import.meta.url),
);
const deliverySource = await Deno.readTextFile(
  new URL("../src/repositories/durable_delivery_repository.ts", import.meta.url),
);

Deno.test("channel and delivery repositories are Drizzle-first and workspace-scoped", () => {
  for (const source of [setupSource, deliverySource]) {
    assertEquals(source.includes(".query("), false);
    assertEquals(source.includes("queryObject"), false);
    assertEquals(source.includes("sql.raw"), false);
    assertStringIncludes(source, "workspaceId");
  }
  assertStringIncludes(deliverySource, "eq(resources.workspaceId, workspaceId)");
  assertStringIncludes(deliverySource, "eq(channels.isActiveForRouting, true)");
  assertStringIncludes(deliverySource, 'kind === "read_later"');
  assertStringIncludes(setupSource, ".onConflictDoUpdate(");
});

Deno.test("pending unique violations map to a domain conflict", async () => {
  const database = {
    insert: () => ({
      values: () => ({ returning: () => Promise.reject({ code: "23505" }) }),
    }),
  } as unknown as AppDatabase;
  const repository = new PostgresDurableDeliveryRepository(database);
  await assertRejects(
    () =>
      repository.createPending("resource", "channel", "share", {
        title: "T",
        url: "https://example.com",
        summary: null,
        whyUseful: null,
        personalNote: null,
        selectedQuote: null,
        includeQuote: false,
        tags: [],
        outputLanguage: "pt-BR",
      }),
    DeliveryConflictError,
  );
});
