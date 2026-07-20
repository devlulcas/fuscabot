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
    services: { auth: false, discord: false },
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
Deno.test("capture waits for enrichment and returns the prepared resource", async () => {
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
  assertEquals(prepared, true);
  assertEquals(body.data.summary, "Prepared by AI");
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
    body: JSON.stringify({ personalNote: "Read this", archived: true }),
    headers: { "content-type": "application/json" },
  });
  assertEquals((await patched.json()).data.personalNote, "Read this");
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
