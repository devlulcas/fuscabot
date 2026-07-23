import { assertEquals, assertRejects } from "@std/assert";
import { DiscordApiError, DiscordClient } from "../src/integrations/discord_client.ts";

const payload = {
  content: "### Title\n\n[example.com](https://example.com)",
  allowed_mentions: { parse: [] as [] },
};

Deno.test("Discord message timeout has unknown outcome", async () => {
  const client = new DiscordClient(
    "token",
    (() => new Promise<Response>(() => {})) as typeof fetch,
    "https://discord.test",
    5,
  );
  const error = await assertRejects(
    () => client.createChannelMessage("channel", payload),
    DiscordApiError,
  );
  assertEquals(error.outcome, "unknown");
});

Deno.test("Discord 429 is known not sent and preserves bounded retry metadata", async () => {
  const client = new DiscordClient(
    "token",
    (() => Promise.resolve(new Response('{"retry_after":2}', { status: 429 }))) as typeof fetch,
    "https://discord.test",
  );
  const error = await assertRejects(
    () => client.createChannelMessage("channel", payload),
    DiscordApiError,
  );
  assertEquals([error.outcome, error.retryAfterMs], ["not_sent", 2_000]);
  assertEquals(error.message.includes("retry_after"), false);
});

Deno.test("Discord successful malformed response fails closed as unknown", async () => {
  const client = new DiscordClient(
    "token",
    (() => Promise.resolve(new Response("not json", { status: 200 }))) as typeof fetch,
    "https://discord.test",
  );
  const error = await assertRejects(
    () => client.createChannelMessage("channel", payload),
    DiscordApiError,
  );
  assertEquals(error.outcome, "unknown");
});

Deno.test("Discord successful invalid message shape fails closed as unknown", async () => {
  const client = new DiscordClient(
    "token",
    (() => Promise.resolve(Response.json({}))) as typeof fetch,
    "https://discord.test",
  );
  const error = await assertRejects(
    () => client.createChannelMessage("channel", payload),
    DiscordApiError,
  );
  assertEquals(error.outcome, "unknown");
});

Deno.test("Discord channel and guild reads reject invalid successful shapes", async () => {
  const client = new DiscordClient(
    "token",
    (() => Promise.resolve(Response.json({}))) as typeof fetch,
    "https://discord.test",
  );
  const channelError = await assertRejects(
    () => client.listGuildTextChannels("guild"),
    DiscordApiError,
  );
  const guildError = await assertRejects(
    () => client.getGuild("guild"),
    DiscordApiError,
  );
  assertEquals([channelError.outcome, guildError.outcome], ["rejected", "rejected"]);
});
