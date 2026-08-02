import type { ApiRuntime, PublicArchiveReader } from "@fuscabot/api";
import { describe, expect, it } from "vitest";
import { _proxyApiRequest } from "../routes/v1/[...path]/+server.ts";

const archive: PublicArchiveReader = {
  list: () => Promise.resolve({ items: [], tags: [], total: 0 }),
  getBySlug: () => Promise.resolve(null),
  listForSitemap: () => Promise.resolve([]),
};

describe("API catch-all", () => {
  it("passes the original request and response through unchanged", async () => {
    let received: Request | undefined;
    const expected = new Response("created", {
      status: 201,
      headers: { "set-cookie": "session=token", "x-api": "preserved" },
    });
    const runtime: ApiRuntime = {
      archive,
      fetch: (request) => {
        received = request;
        return Promise.resolve(expected);
      },
    };
    const request = new Request("https://fuscabot.xyz/v1/resources?tag=deno", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: '{"url":"https://deno.com"}',
    });

    const response = await _proxyApiRequest(request, runtime);
    expect(received).toBe(request);
    expect(response).toBe(expected);
    expect(response.headers.get("set-cookie")).toBe("session=token");
  });
});
