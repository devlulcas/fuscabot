import { assertEquals } from "@std/assert";
import { createApp } from "../src/app.ts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import { ResourceService } from "../src/services/resource_service.ts";

const capture = {
  captureId: "019432f0-7c00-7000-8000-000000000001",
  url: "https://Example.com/post?utm_source=x&id=3",
  title: "Useful post",
};
function app() {
  return createApp({ resources: new ResourceService(new InMemoryResourceRepository()) });
}

Deno.test("health responds without database", async () => {
  assertEquals(await (await app().request("/health")).json(), { status: "ok" });
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
  assertEquals(created.data.normalizedUrl, "https://example.com/post?id=3");
  const second = await instance.request("/v1/resources/captures", {
    method: "POST",
    body: JSON.stringify(capture),
    headers: { "content-type": "application/json" },
  });
  assertEquals(second.status, 200);
  assertEquals((await second.json()).meta.created, false);
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
  assertEquals((await bad.json()).error.code, "validation_error");
});
