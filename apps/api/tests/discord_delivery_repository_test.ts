import { assertEquals, assertStringIncludes } from "@std/assert";

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

Deno.test("pending delivery creation serializes and rejects active destinations", () => {
  assertStringIncludes(deliverySource, "pg_advisory_xact_lock");
  assertStringIncludes(deliverySource, '["pending", "sent", "unknown"]');
  assertStringIncludes(deliverySource, "throw new DeliveryConflictError");
  assertStringIncludes(deliverySource, 'error.code === "23505"');
});
