import { assertEquals } from "@std/assert";
import { hc, type InferRequestType } from "hono/client";
import type { AppType } from "@fuscabot/api";

Deno.test("AppType exposes the API routes to the Hono client", () => {
  const client = hc<AppType>("http://localhost:8000");

  const listRequest: InferRequestType<typeof client.v1.resources.$get> = {
    query: { limit: "10", offset: "0" },
  };
  const captureRequest: InferRequestType<typeof client.v1.resources.captures.$post> = {
    json: {
      captureId: "019432f0-7c00-7000-8000-000000000001",
      url: "https://example.com/article",
      title: "Example article",
      metadata: {},
    },
  };

  assertEquals(typeof client.v1.resources.$get, "function");
  assertEquals(typeof client.v1.resources.captures.$post, "function");
  assertEquals(typeof client.v1.auth.session.$get, "function");
  assertEquals(listRequest.query?.limit, "10");
  assertEquals(captureRequest.json.title, "Example article");
});
