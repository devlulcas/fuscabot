import { assertEquals } from "@std/assert";
import { createApp } from "../src/app.ts";
import { DiscordClient } from "../src/integrations/discord_client.ts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import { AuthService } from "../src/services/auth_service.ts";
import { ResourceService } from "../src/services/resource_service.ts";

const authFetch: typeof fetch = (input) => {
  const url = String(input);
  if (url.endsWith("/oauth2/token")) {
    return Promise.resolve(Response.json({
      access_token: "discord-user-token",
      token_type: "Bearer",
      guild: { id: "guild-1" },
    }));
  }
  if (url.endsWith("/users/@me/guilds")) {
    return Promise.resolve(Response.json([{ id: "guild-1", owner: true, permissions: "0" }]));
  }
  return Promise.resolve(Response.json({ id: "owner-1" }));
};

const botFetch: typeof fetch = (input) => {
  const url = String(input);
  if (url.endsWith("/guilds/guild-1/channels")) {
    return Promise.resolve(Response.json([
      { id: "text-1", name: "links", type: 0, parent_id: null, topic: "Useful links" },
      { id: "forum-1", name: "forum", type: 15, parent_id: null, topic: null },
    ]));
  }
  return Promise.resolve(Response.json({ id: "guild-1", name: "My server", icon: null }));
};

function app() {
  return createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    auth: new AuthService({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://fuscabot.devlulcas.deno.net/v1/auth/discord/callback",
      ownerDiscordUserId: "owner-1",
      signingSecret: "a-secure-signing-secret-with-more-than-32-characters",
    }, authFetch),
    discord: new DiscordClient("bot-token", botFetch),
    allowedOrigins: ["chrome-extension://example"],
  });
}

Deno.test("OAuth routes hand a session back to Chrome and protect the API", async () => {
  const instance = app();
  const unauthenticated = await instance.request("/v1/auth/session");
  assertEquals(unauthenticated.status, 401);

  const extensionRedirect = "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord";
  const start = await instance.request(
    `/v1/auth/discord/start?${new URLSearchParams({ extension_redirect: extensionRedirect })}`,
  );
  assertEquals(start.status, 302);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const callback = await instance.request(
    `/v1/auth/discord/callback?${new URLSearchParams({ code: "code", state })}`,
  );
  assertEquals(callback.status, 302);
  const accessToken = new URLSearchParams(
    new URL(callback.headers.get("location")!).hash.slice(1),
  ).get("access_token")!;
  const headers = { authorization: `Bearer ${accessToken}` };

  const session = await instance.request("/v1/auth/session", { headers });
  assertEquals(session.status, 200);
  assertEquals((await session.json()).data.discordUserId, "owner-1");

  const guilds = await instance.request("/v1/setup/discord/guilds", { headers });
  assertEquals((await guilds.json()).data[0].name, "My server");

  const channels = await instance.request("/v1/discord/channels/sync", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ guildId: "guild-1" }),
  });
  assertEquals((await channels.json()).data.map((channel: { id: string }) => channel.id), [
    "text-1",
  ]);
});
