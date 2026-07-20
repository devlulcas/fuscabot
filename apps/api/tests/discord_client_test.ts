import { assertEquals, assertRejects } from "@std/assert";
import { DiscordApiError, DiscordClient } from "../src/integrations/discord_client.ts";

Deno.test("Discord client filters standard text channels and authenticates", async () => {
  let authorization = "";
  const client = new DiscordClient("secret", (request, init) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    assertEquals(String(request), "https://discord.test/guilds/guild/channels");
    return Promise.resolve(Response.json([
      { id: "text", name: "links", type: 0, parent_id: null, topic: null },
      { id: "forum", name: "forum", type: 15, parent_id: null, topic: null },
    ]));
  }, "https://discord.test");
  assertEquals((await client.listGuildTextChannels("guild")).map((row) => row.id), ["text"]);
  assertEquals(authorization, "Bot secret");
});

Deno.test("Discord client forces safe allowed mentions", async () => {
  let body: Record<string, unknown> = {};
  const client = new DiscordClient("secret", (_request, init) => {
    body = JSON.parse(String(init?.body));
    return Promise.resolve(Response.json({ id: "message", channel_id: "channel" }));
  });
  await client.createChannelMessage("channel", {
    embeds: [{ title: "Title", url: "https://example.com" }],
    allowed_mentions: { parse: ["users"] },
  });
  assertEquals(body.allowed_mentions, { parse: [] });
});

Deno.test("Discord errors expose retry delay", async () => {
  const client = new DiscordClient(
    "secret",
    () =>
      Promise.resolve(
        Response.json({ message: "rate limited", retry_after: 1.5 }, { status: 429 }),
      ),
  );
  const error = await assertRejects(() => client.listGuildTextChannels("guild"), DiscordApiError);
  assertEquals(error.status, 429);
  assertEquals(error.retryAfterMs, 1500);
});
