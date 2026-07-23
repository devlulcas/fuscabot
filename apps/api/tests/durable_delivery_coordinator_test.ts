import { assertEquals, assertRejects } from "@std/assert";
import type { DeliverySnapshot } from "../../../packages/contracts/mod.ts";
import {
  DeliveryNotRetryableError,
  type DeliveryRecord,
  DeliveryTargetNotAllowedError,
} from "../src/domain/durable_delivery.ts";
import {
  DurableDeliveryCoordinator,
  type DurableDeliveryStore,
} from "../src/services/durable_delivery_coordinator.ts";
import { DiscordApiError } from "../src/integrations/discord_client.ts";
const snapshot: DeliverySnapshot = {
  version: 2,
  title: "Title",
  url: "https://example.com",
  summary: "Original",
  personalNote: null,
  selectedQuote: null,
  includeQuote: false,
  tags: [],
  outputLanguage: "pt-BR",
  sourceDomain: "example.com",
  capturedAt: "2026-07-21T12:00:00Z",
  destinationLabel: "#links",
  payload: {
    content: "### Title\n\n[example.com](https://example.com)",
    allowed_mentions: { parse: [] },
  },
};
function record(
  status: DeliveryRecord["status"],
  retryOfDeliveryId: string | null = null,
): DeliveryRecord {
  return {
    id: "delivery",
    resourceId: "resource",
    channelId: "channel",
    discordChannelId: "discord-channel",
    guildId: "guild",
    kind: "share",
    snapshot: structuredClone(snapshot),
    status,
    externalMessageId: null,
    externalUrl: null,
    error: status === "failed" ? "failed" : null,
    retryOfDeliveryId,
  };
}
function memory(initial: DeliveryRecord | null = null) {
  let current = initial;
  const retries: string[] = [];
  const store: DurableDeliveryStore = {
    authorizeTarget: () =>
      Promise.resolve({ discord_channel_id: "discord-channel", discord_guild_id: "guild" }),
    createPending: (_r, _c, _k, s, retryOf = null) => {
      retries.push(retryOf ?? "");
      current = { ...record("pending", retryOf), snapshot: structuredClone(s) };
      return Promise.resolve(current);
    },
    markSent: (_id, messageId, url) => {
      current = { ...current!, status: "sent", externalMessageId: messageId, externalUrl: url };
      return Promise.resolve(current);
    },
    markFailed: (_id, error) => {
      current = { ...current!, status: "failed", error };
      return Promise.resolve(current);
    },
    markUnknown: (_id, error) => {
      current = { ...current!, status: "unknown", error };
      return Promise.resolve(current);
    },
    get: () => Promise.resolve(current),
    history: () => Promise.resolve(current ? [current] : []),
  };
  return { store, retries, get: () => current };
}
Deno.test("delivery persists immutable pending snapshot before Discord and marks sent", async () => {
  const state = memory();
  const input = structuredClone(snapshot);
  let pendingSeen = false;
  const coordinator = new DurableDeliveryCoordinator(state.store, {
    createChannelMessage: (_channel, sent) => {
      pendingSeen = state.get()?.status === "pending";
      assertEquals(sent.summary, "Original");
      assertEquals(
        "version" in sent && sent.payload,
        "version" in snapshot && snapshot.payload,
      );
      input.summary = "Changed later";
      if ("version" in input) input.payload.content = "Changed later";
      return Promise.resolve({ id: "message" });
    },
  });
  const sent = await coordinator.publish("workspace", "resource", "channel", "share", input);
  assertEquals(pendingSeen, true);
  assertEquals([sent.status, sent.snapshot.summary, sent.externalUrl], [
    "sent",
    "Original",
    "https://discord.com/channels/guild/discord-channel/message",
  ]);
  assertEquals(
    "version" in sent.snapshot && sent.snapshot.payload.content,
    "### Title\n\n[example.com](https://example.com)",
  );
});
Deno.test("unknown Discord outcome blocks blind retry and stores no upstream detail", async () => {
  const state = memory();
  const coordinator = new DurableDeliveryCoordinator(state.store, {
    createChannelMessage: () =>
      Promise.reject(new DiscordApiError("secret upstream body", 0, null, "unknown")),
  });
  await assertRejects(
    () => coordinator.publish("workspace", "resource", "channel", "share", snapshot),
    DiscordApiError,
  );
  assertEquals(state.get()?.status, "unknown");
  assertEquals(state.get()?.error, "Discord delivery outcome is unknown");
  await assertRejects(
    () => coordinator.retry("workspace", "delivery"),
    DeliveryNotRetryableError,
  );
});
Deno.test("failed retry reuses snapshot and links attempts", async () => {
  const failed = record("failed");
  const expected = structuredClone(failed.snapshot);
  const state = memory(failed);
  let retried: DeliverySnapshot | undefined;
  const coordinator = new DurableDeliveryCoordinator(state.store, {
    createChannelMessage: (_channel, sent) => {
      retried = structuredClone(sent);
      return Promise.resolve({ id: "retry-message" });
    },
  });
  const sent = await coordinator.retry("workspace", "delivery");
  assertEquals([sent.status, state.retries], ["sent", ["delivery"]]);
  assertEquals(retried, expected);
  await assertRejects(() => coordinator.retry("workspace", "delivery"), DeliveryNotRetryableError);
});
Deno.test("unauthorized destination is rejected before pending creation", async () => {
  const state = memory();
  state.store.authorizeTarget = () => Promise.resolve(null);
  const coordinator = new DurableDeliveryCoordinator(state.store, {
    createChannelMessage: () => Promise.resolve({ id: "no" }),
  });
  await assertRejects(
    () => coordinator.publish("workspace", "resource", "channel", "share", snapshot),
    DeliveryTargetNotAllowedError,
  );
  assertEquals(state.get(), null);
});
