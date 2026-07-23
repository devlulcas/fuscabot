import { assertEquals, assertThrows } from "@std/assert";
import { loadEnv, requireRuntimeEnv } from "../src/config/env.ts";

const runtime = {
  DATABASE_URL: "postgresql://localhost/fuscabot",
  OWNER_DISCORD_USER_ID: "owner",
  DISCORD_BOT_TOKEN: "bot",
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  DISCORD_OAUTH_REDIRECT_URI: "https://api.example/v1/auth/discord/callback",
  MISTRAL_API_KEY: "mistral",
  APP_SESSION_SIGNING_SECRET: "a-secure-signing-secret-with-more-than-32-characters",
  PUBLIC_SITE_ORIGIN: "https://fuscabot.xyz",
};

Deno.test("runtime requires exact extension or local development origins", () => {
  assertThrows(() => requireRuntimeEnv(loadEnv(runtime)));
  assertThrows(() =>
    requireRuntimeEnv(loadEnv({
      ...runtime,
      ALLOWED_EXTENSION_ORIGINS: "https://evil.example",
    }))
  );
  assertEquals(
    requireRuntimeEnv(loadEnv({
      ...runtime,
      ALLOWED_EXTENSION_ORIGINS: "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    })).ALLOWED_EXTENSION_ORIGINS,
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
  );
  assertEquals(
    requireRuntimeEnv(loadEnv({
      ...runtime,
      ALLOWED_EXTENSION_ORIGINS: "http://localhost:8000",
    })).ALLOWED_EXTENSION_ORIGINS,
    "http://localhost:8000",
  );
});

Deno.test("runtime validates public origin and complete Umami configuration", () => {
  const base = {
    ...runtime,
    ALLOWED_EXTENSION_ORIGINS: "http://localhost:8000",
  };
  assertThrows(() =>
    requireRuntimeEnv(loadEnv({
      ...base,
      PUBLIC_SITE_ORIGIN: "https://example.com/archive",
    }))
  );
  assertThrows(() =>
    requireRuntimeEnv(loadEnv({
      ...base,
      UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",
    }))
  );
  assertThrows(() =>
    requireRuntimeEnv(loadEnv({
      ...base,
      UMAMI_SCRIPT_URL: "http://analytics.example/script.js",
      UMAMI_WEBSITE_ID: "b7f428a4-b9d3-402d-a8ec-f5ba944f728f",
    }))
  );
  const configured = requireRuntimeEnv(loadEnv({
    ...base,
    UMAMI_SCRIPT_URL: "https://cloud.umami.is/script.js",
    UMAMI_WEBSITE_ID: "b7f428a4-b9d3-402d-a8ec-f5ba944f728f",
  }));
  assertEquals(configured.PUBLIC_SITE_ORIGIN, "https://fuscabot.xyz");
  assertEquals(configured.UMAMI_WEBSITE_ID, "b7f428a4-b9d3-402d-a8ec-f5ba944f728f");
});
