import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { DeliveryConflictError } from "../src/domain/durable_delivery.ts";
import {
  AUTHORIZE_TARGET_SQL,
  CREATE_PENDING_SQL,
  PostgresDurableDeliveryRepository,
} from "../src/repositories/durable_delivery_repository.ts";
import {
  MARK_MISSING_SQL,
  UPDATE_CHANNEL_SQL,
  UPSERT_CHANNEL_SQL,
} from "../src/repositories/discord_setup_repository.ts";
Deno.test("channel SQL preserves routing fields while marking missing unavailable", () => {
  assertStringIncludes(UPSERT_CHANNEL_SQL, "ON CONFLICT");
  assertEquals(UPSERT_CHANNEL_SQL.includes("routing_description="), false);
  assertStringIncludes(MARK_MISSING_SQL, "availability='unavailable'");
  assertStringIncludes(UPDATE_CHANNEL_SQL, "availability='available'");
});
Deno.test("delivery target SQL scopes resource/channel/workspace and Read Later", () => {
  assertStringIncludes(AUTHORIZE_TARGET_SQL, "r.workspace_id=$1::uuid");
  assertStringIncludes(AUTHORIZE_TARGET_SQL, "c.is_active_for_routing");
  assertStringIncludes(AUTHORIZE_TARGET_SQL, "c.is_read_later");
});
Deno.test("pending unique violations map to a domain conflict", async () => {
  const repository = new PostgresDurableDeliveryRepository({
    queryObject: () => Promise.reject({ code: "23505" }),
  });
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
  assertStringIncludes(CREATE_PENDING_SQL, "message_snapshot");
});
