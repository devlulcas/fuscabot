import { assertEquals, assertStringIncludes } from "@std/assert";
import { createApp } from "../src/app.ts";
import type { PublicArchiveReader } from "../src/repositories/public_archive_repository.ts";
import { createApiRuntime, createRuntimeHandler } from "../src/server.ts";

const archive: PublicArchiveReader = {
  list: () => Promise.resolve({ items: [], total: 0, tags: [] }),
  getBySlug: () => Promise.resolve(null),
  listForSitemap: () => Promise.resolve([]),
};

const runtime = () => ({
  fetch: () => Response.json({ data: "ok" }),
  archive,
});

Deno.test("liveness is dependency-free and does not initialize runtime", async () => {
  let builds = 0;
  const handler = createRuntimeHandler({}, {
    build: () => {
      builds++;
      return Promise.resolve(runtime());
    },
  });
  const response = await handler(new Request("https://api.test/health"));
  assertEquals([response.status, await response.json(), builds], [200, { status: "ok" }, 0]);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
});

Deno.test("non-API routes use the JSON not-found envelope", async () => {
  const api = createApp();
  const handler = createRuntimeHandler({}, {
    build: () =>
      Promise.resolve({
        fetch: (request: Request) => api.fetch(request),
        archive,
      }),
  });

  for (const path of ["/", "/healthz", "/readyz", "/assets/app.css", "/missing"]) {
    const response = await handler(new Request(`https://api.test${path}`));
    assertEquals(response.status, 404);
    assertEquals(await response.json(), {
      error: { code: "NOT_FOUND", message: "Route not found", retryable: false },
    });
    assertEquals(Boolean(response.headers.get("x-request-id")), true);
    assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  }
});

Deno.test("requests fail closed without leaking initialization details", async () => {
  const sentinel = "postgres://secret:password@database.internal/app";
  const handler = createRuntimeHandler({}, {
    build: () => Promise.reject(new Error(sentinel)),
  });
  const response = await handler(new Request("https://api.test/v1/resources"));
  const text = await response.text();
  assertEquals(response.status, 503);
  assertEquals(text.includes(sentinel), false);
  assertStringIncludes(text, '"code":"DEPENDENCY_ERROR"');
  assertEquals(Boolean(response.headers.get("x-request-id")), true);
});

Deno.test("concurrent requests initialize the runtime once", async () => {
  let builds = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => release = resolve);
  const handler = createRuntimeHandler({}, {
    build: async () => {
      builds++;
      await waiting;
      return runtime();
    },
  });
  const requests = [
    handler(new Request("https://api.test/v1/resources")),
    handler(new Request("https://api.test/v1/tags")),
  ];
  release();
  const responses = await Promise.all(requests);
  assertEquals([builds, ...responses.map((response) => response.status)], [1, 200, 200]);
});

Deno.test("API fetches and archive reads share one lazy runtime", async () => {
  let builds = 0;
  const runtimeFacade = createApiRuntime({}, {
    build: () => {
      builds++;
      return Promise.resolve(runtime());
    },
  });

  const [response, result] = await Promise.all([
    runtimeFacade.fetch(new Request("https://api.test/v1/resources")),
    runtimeFacade.archive.list({ locale: "en", page: 1, pageSize: 20 }),
  ]);

  assertEquals(response.status, 200);
  assertEquals(result.total, 0);
  assertEquals(builds, 1);
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
