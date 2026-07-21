import { assertEquals } from "@std/assert";
import { createApp } from "../src/app.ts";
import { InMemoryRateLimitStore } from "../src/http/rate_limit.ts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import type { AuthService } from "../src/services/auth_service.ts";
import { ResourceService } from "../src/services/resource_service.ts";

Deno.test("rate-limit store handles concurrent threshold and window expiry atomically", async () => {
  let now = 1_000;
  const store = new InMemoryRateLimitStore(() => now);
  const input = { scope: "captures", key: "session", limit: 5, windowMs: 1_000 };
  const results = await Promise.all(Array.from({ length: 8 }, () => store.consume(input)));
  assertEquals(results.filter((result) => result.allowed).length, 5);
  assertEquals(results.at(-1)?.remaining, 0);
  now = 2_001;
  assertEquals((await store.consume(input)).allowed, true);
});

Deno.test("Hono policies separate public and authenticated buckets and skip preflight", async () => {
  const store = new InMemoryRateLimitStore(() => 1_000);
  const auth = {
    authorizationUrl: () => Promise.resolve("https://discord.com/oauth2/authorize"),
    verifySession: (token: string) =>
      Promise.resolve({
        sub: "owner",
        sid: token === "first"
          ? "019432f0-7c00-7000-8000-000000000001"
          : "019432f0-7c00-7000-8000-000000000002",
        guildIds: [],
        exp: Date.now() + 60_000,
      }),
  } as unknown as AuthService;
  const app = createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    auth,
    rateLimits: store,
    rateLimitPolicies: {
      publicAuth: { limit: 2, windowMs: 60_000 },
      reads: { limit: 1, windowMs: 60_000 },
    },
  });
  const startPath = "/v1/auth/discord/start?extension_redirect=" +
    encodeURIComponent("https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/discord");
  assertEquals((await app.request(startPath)).status, 302);
  assertEquals((await app.request(startPath)).status, 302);
  const limited = await app.request(startPath);
  assertEquals(limited.status, 429);
  assertEquals(limited.headers.get("retry-after"), "59");

  assertEquals(
    (await app.request("/v1/resources", {
      headers: { authorization: "Bearer first" },
    })).status,
    200,
  );
  assertEquals(
    (await app.request("/v1/resources", {
      headers: { authorization: "Bearer first" },
    })).status,
    429,
  );
  assertEquals(
    (await app.request("/v1/resources", {
      headers: { authorization: "Bearer second" },
    })).status,
    200,
  );
  assertEquals(
    (await app.request("/v1/resources", {
      method: "OPTIONS",
      headers: { authorization: "Bearer first" },
    })).status,
    204,
  );
});
