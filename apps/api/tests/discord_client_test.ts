import { assertEquals, assertRejects } from "@std/assert";
import { DiscordApiError, DiscordClient } from "../src/integrations/discord_client.ts";

const payload = {
  embeds: [{ title: "Title", url: "https://example.com" }],
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
