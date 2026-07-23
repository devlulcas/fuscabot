import { assertEquals } from "@std/assert";
import { ApiErrorSchema, ResourceSchema } from "@fuscabot/contracts";
import { createApp } from "../src/app.ts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import { ResourceService } from "../src/services/resource_service.ts";

const capture = {
  captureId: "019432f0-7c00-7000-8000-000000000001",
  url: "https://Example.com/post?utm_source=x&id=3",
  title: "Useful post",
  metadata: {},
};
function app() {
  return createApp({ resources: new ResourceService(new InMemoryResourceRepository()) });
}

Deno.test("health responds without database", async () => {
  assertEquals(await (await app().request("/health")).json(), {
    status: "ok",
  });
});
Deno.test("production mode fails closed when authentication is unavailable", async () => {
  const instance = createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    requireAuth: true,
  });
  assertEquals((await instance.request("/v1/resources")).status, 503);
});
Deno.test("capture is idempotent and strips tracking keys", async () => {
  const instance = app();
  const first = await instance.request("/v1/resources/captures", {
    method: "POST",
    body: JSON.stringify(capture),
    headers: { "content-type": "application/json" },
  });
  assertEquals(first.status, 201);
  const created = await first.json();
  ResourceSchema.parse(created.data);
  assertEquals(created.data.normalizedUrl, "https://example.com/post?id=3");
  const second = await instance.request("/v1/resources/captures", {
    method: "POST",
    body: JSON.stringify(capture),
    headers: { "content-type": "application/json" },
  });
  assertEquals(second.status, 200);
  assertEquals((await second.json()).meta.created, false);
});
Deno.test("capture persists and responds without waiting for enrichment", async () => {
  const resources = new ResourceService(new InMemoryResourceRepository());
  let prepared = false;
  const instance = createApp({
    resources,
    enrichment: {
      async prepare(_ownerId, resourceId) {
        await resources.patch(resourceId, { summary: "Prepared by AI" });
        prepared = true;
      },
      retry: () => Promise.resolve(undefined),
      get: () => Promise.resolve(undefined),
    },
  });
  const response = await instance.request("/v1/resources/captures", {
    method: "POST",
    body: JSON.stringify(capture),
    headers: { "content-type": "application/json" },
  });
  const body = await response.json();
  assertEquals(prepared, false);
  assertEquals(body.data.enrichmentStatus, "preparing");
});
Deno.test("resource pages expose reliable hasMore metadata", async () => {
  const instance = app();
  for (let index = 1; index <= 3; index++) {
    await instance.request("/v1/resources/captures", {
      method: "POST",
      body: JSON.stringify({
        ...capture,
        captureId: `019432f0-7c00-7000-8000-${String(index).padStart(12, "0")}`,
        url: `https://example.com/${index}`,
      }),
      headers: { "content-type": "application/json" },
    });
  }
  const first = await (await instance.request("/v1/resources?limit=2&offset=0")).json();
  assertEquals(first.data.length, 2);
  assertEquals(first.meta, { limit: 2, offset: 0, hasMore: true });
  const second = await (await instance.request("/v1/resources?limit=2&offset=2")).json();
  assertEquals(second.data.length, 1);
  assertEquals(second.meta.hasMore, false);
});
Deno.test("CRUD and validation error envelope", async () => {
  const instance = app();
  await instance.request("/v1/resources/captures", {
    method: "POST",
    body: JSON.stringify(capture),
    headers: { "content-type": "application/json" },
  });
  const patched = await instance.request(`/v1/resources/${capture.captureId}`, {
    method: "PATCH",
    body: JSON.stringify({
      personalNote: "Read this",
      archived: true,
      tagSlugs: ["New Tag", "new-tag"],
    }),
    headers: { "content-type": "application/json" },
  });
  const updated = (await patched.json()).data;
  assertEquals(updated.personalNote, "Read this");
  assertEquals(updated.tags, [{
    slug: "new-tag",
    labels: [
      { language: "en", name: "new-tag" },
      { language: "pt-BR", name: "new-tag" },
    ],
    aliases: [],
    source: "user",
  }]);
  assertEquals(
    (await instance.request(`/v1/resources/${capture.captureId}`, { method: "DELETE" })).status,
    204,
  );
  const bad = await instance.request("/v1/resources/captures", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  assertEquals(bad.status, 400);
  const error = ApiErrorSchema.parse(await bad.json());
  assertEquals(error.error.code, "VALIDATION_ERROR");
});

Deno.test("bulk resource actions archive, restore, and delete atomically", async () => {
  const instance = app();
  const second = {
    ...capture,
    captureId: "019432f0-7c00-7000-8000-000000000002",
    url: "https://example.com/second",
  };
  for (const input of [capture, second]) {
    assertEquals(
      (await instance.request("/v1/resources/captures", {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
      })).status,
      201,
    );
  }
  const bulk = (ids: string[], action: "archive" | "restore" | "delete") =>
    instance.request("/v1/resources/bulk-actions", {
      method: "POST",
      body: JSON.stringify({ ids, action }),
      headers: { "content-type": "application/json" },
    });
  const archived = await bulk([capture.captureId, second.captureId], "archive");
  assertEquals(archived.status, 200);
  assertEquals((await archived.json()).data.affectedIds, [capture.captureId, second.captureId]);

  const missing = await bulk(
    [capture.captureId, "019432f0-7c00-7000-8000-000000000099"],
    "delete",
  );
  assertEquals(missing.status, 404);
  assertEquals((await instance.request(`/v1/resources/${capture.captureId}`)).status, 200);

  assertEquals((await bulk([capture.captureId], "restore")).status, 200);
  assertEquals((await bulk([capture.captureId, second.captureId], "delete")).status, 200);
  assertEquals((await instance.request(`/v1/resources/${capture.captureId}`)).status, 404);
});

Deno.test("JSON boundaries reject declared, streamed, and malformed bodies safely", async () => {
  const instance = createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    maxJsonBytes: 64,
  });
  const declared = await instance.request("/v1/resources/captures", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "65" },
    body: "{}",
  });
  assertEquals(declared.status, 413);
  assertEquals((await declared.json()).error.code, "PAYLOAD_TOO_LARGE");
  assertEquals(Boolean(declared.headers.get("x-request-id")), true);

  const streamed = await instance.request("/v1/resources/captures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(100) }),
  });
  assertEquals(streamed.status, 413);

  const malformed = await createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
  }).request("/v1/resources/captures", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{broken",
  });
  assertEquals(malformed.status, 400);
  assertEquals((await malformed.json()).error.code, "VALIDATION_ERROR");
  assertEquals(malformed.headers.get("x-content-type-options"), "nosniff");
});

Deno.test("CORS reflects only configured extension origins and preserves cache variance", async () => {
  const allowedOrigin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
  const instance = createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    allowedOrigins: [allowedOrigin],
  });
  const allowed = await instance.request("/v1/resources", {
    headers: { origin: allowedOrigin },
  });
  assertEquals(allowed.headers.get("access-control-allow-origin"), allowedOrigin);
  assertEquals(allowed.headers.get("vary"), "Origin");

  const untrusted = await instance.request("/v1/resources", {
    headers: { origin: "https://evil.example" },
  });
  assertEquals(untrusted.headers.get("access-control-allow-origin"), null);

  const preflight = await instance.request("/v1/resources", {
    method: "OPTIONS",
    headers: { origin: allowedOrigin },
  });
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("access-control-allow-origin"), allowedOrigin);
  assertEquals(Boolean(preflight.headers.get("x-request-id")), true);
});
