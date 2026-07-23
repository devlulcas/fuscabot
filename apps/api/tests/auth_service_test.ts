import { assertEquals, assertRejects } from "@std/assert";
import { AuthError, AuthService } from "../src/services/auth_service.ts";

const config = {
  clientId: "1528786564874768565",
  clientSecret: "discord-secret",
  redirectUri: "https://fuscabot.xyz/v1/auth/discord/callback",
  ownerDiscordUserId: "owner-1",
  signingSecret: "a-secure-signing-secret-with-more-than-32-characters",
  extensionRedirectOrigins: [
    "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org",
  ],
};

function discordFetch(ownerId = "owner-1"): typeof fetch {
  return (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) {
      return Promise.resolve(Response.json({
        access_token: "discord-access-token",
        token_type: "Bearer",
        guild: { id: "guild-1" },
      }));
    }
    if (url.endsWith("/users/@me/guilds")) {
      return Promise.resolve(Response.json([
        { id: "guild-1", owner: true, permissions: "0" },
        { id: "guild-without-management", owner: false, permissions: "1024" },
      ]));
    }
    if (url.endsWith("/users/@me")) return Promise.resolve(Response.json({ id: ownerId }));
    return Promise.resolve(Response.json({ message: "not found" }, { status: 404 }));
  };
}

Deno.test("OAuth URL has the approved scopes, permission total, and signed state", async () => {
  const service = new AuthService(config, discordFetch(), () => 1_000_000);
  const url = new URL(
    await service.authorizationUrl(
      "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord",
    ),
  );
  assertEquals(url.origin + url.pathname, "https://discord.com/oauth2/authorize");
  assertEquals(url.searchParams.get("client_id"), config.clientId);
  assertEquals(url.searchParams.get("permissions"), "19456");
  assertEquals(url.searchParams.get("scope"), "identify guilds bot");
  assertEquals(url.searchParams.get("redirect_uri"), config.redirectUri);
  assertEquals(Boolean(url.searchParams.get("state")), true);
});

Deno.test("OAuth completion enforces owner and creates a signed session", async () => {
  const service = new AuthService(config, discordFetch(), () => 1_000_000);
  const authorization = new URL(
    await service.authorizationUrl(
      "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord",
    ),
  );
  const completed = await service.complete("code", authorization.searchParams.get("state")!);
  const claims = await service.verifySession(completed.accessToken);
  assertEquals(claims.sub, "owner-1");
  assertEquals(claims.guildIds, ["guild-1"]);
  const refreshed = await service.refresh(completed.sessionId, completed.refreshToken);
  assertEquals((await service.verifySession(refreshed.accessToken)).guildIds, ["guild-1"]);
  await assertRejects(
    () => service.refresh(completed.sessionId, completed.refreshToken),
    AuthError,
    "invalid",
  );
  await service.revoke(completed.sessionId);
  await assertRejects(() => service.verifySession(refreshed.accessToken), AuthError);
  await assertRejects(
    () => service.verifySession(`${completed.accessToken}tampered`),
    AuthError,
  );
});

Deno.test("OAuth state is single use", async () => {
  const service = new AuthService(config, discordFetch(), () => 1_000_000);
  const authorization = new URL(
    await service.authorizationUrl(
      "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord",
    ),
  );
  const state = authorization.searchParams.get("state")!;
  await service.complete("code", state);
  await assertRejects(() => service.complete("code", state), AuthError, "already used");
});

Deno.test("OAuth completion rejects a different Discord owner", async () => {
  const service = new AuthService(config, discordFetch("intruder"), () => 1_000_000);
  const authorization = new URL(
    await service.authorizationUrl(
      "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord",
    ),
  );
  await assertRejects(
    () => service.complete("code", authorization.searchParams.get("state")!),
    AuthError,
    "not allowed",
  );
});

Deno.test("OAuth start accepts only controlled Chromium extension redirects", async () => {
  const service = new AuthService(config, discordFetch());
  await assertRejects(
    () => service.authorizationUrl("https://evil.example/callback"),
    AuthError,
    "Invalid extension redirect",
  );
  await assertRejects(
    () =>
      service.authorizationUrl(
        "https://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.chromiumapp.org/discord",
      ),
    AuthError,
    "Invalid extension redirect",
  );
  await assertRejects(
    () =>
      service.authorizationUrl(
        "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord?next=evil",
      ),
    AuthError,
    "Invalid extension redirect",
  );
});

Deno.test("OAuth completion rejects expired state", async () => {
  let now = 1_000_000;
  const service = new AuthService(config, discordFetch(), () => now);
  const authorization = new URL(
    await service.authorizationUrl(
      "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord",
    ),
  );
  now += 11 * 60_000;
  await assertRejects(
    () => service.complete("code", authorization.searchParams.get("state")!),
    AuthError,
    "expired",
  );
});

Deno.test("OAuth completion rejects tampered state as a client error", async () => {
  const service = new AuthService(config, discordFetch());
  const error = await assertRejects(
    () => service.complete("code", "tampered.state"),
    AuthError,
    "OAuth state is invalid",
  );
  assertEquals(error.status, 400);
});
