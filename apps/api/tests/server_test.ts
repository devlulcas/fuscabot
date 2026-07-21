import { assertEquals, assertStringIncludes } from "@std/assert";
import { createRuntimeHandler } from "../src/server.ts";

const runtime = (readiness: () => Promise<void> = () => Promise.resolve()) => ({
  fetch: () => Response.json({ data: "ok" }),
  readiness,
});

Deno.test("liveness is dependency-free and does not initialize runtime", async () => {
  let builds = 0;
  const handler = createRuntimeHandler({}, {
    build: () => {
      builds++;
      return Promise.resolve(runtime());
    },
  });
  const response = await handler(new Request("https://api.test/healthz"));
  assertEquals([response.status, await response.json(), builds], [200, { status: "ok" }, 0]);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
});

Deno.test("readiness fails closed without leaking initialization details", async () => {
  const sentinel = "postgres://secret:password@database.internal/app";
  const handler = createRuntimeHandler({}, {
    build: () => Promise.reject(new Error(sentinel)),
  });
  const response = await handler(new Request("https://api.test/readyz"));
  const text = await response.text();
  assertEquals(response.status, 503);
  assertEquals(text.includes(sentinel), false);
  assertStringIncludes(text, '"code":"DEPENDENCY_ERROR"');
  assertEquals(Boolean(response.headers.get("x-request-id")), true);
});

Deno.test("readiness probes dependencies and concurrent initialization runs once", async () => {
  let builds = 0;
  let probes = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => release = resolve);
  const handler = createRuntimeHandler({}, {
    build: async () => {
      builds++;
      await waiting;
      return runtime(() => {
        probes++;
        return Promise.resolve();
      });
    },
  });
  const requests = [
    handler(new Request("https://api.test/readyz")),
    handler(new Request("https://api.test/v1/resources")),
  ];
  release();
  const [ready, api] = await Promise.all(requests);
  assertEquals([builds, probes, ready.status, api.status], [1, 1, 200, 200]);
});

Deno.test("initialization failures use a cooldown before retry", async () => {
  let builds = 0;
  let now = 1_000;
  const handler = createRuntimeHandler({}, {
    now: () => now,
    failureCooldownMs: 100,
    build: () => {
      builds++;
      return Promise.reject(new Error("offline"));
    },
  });
  await handler(new Request("https://api.test/v1/resources"));
  await handler(new Request("https://api.test/v1/resources"));
  assertEquals(builds, 1);
  now = 1_101;
  await handler(new Request("https://api.test/v1/resources"));
  assertEquals(builds, 2);
});
