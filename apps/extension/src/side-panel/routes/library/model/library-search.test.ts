import { describe, expect, it } from "vitest";
import { librarySearchParams, parseLibrarySearch } from "./library-search.ts";

describe("library URL-state codec", () => {
  it("normalizes invalid and default values", () => {
    expect(parseLibrarySearch(new URLSearchParams("page=-2&sort=wrong")))
      .toEqual({
        q: "",
        state: undefined,
        visibility: undefined,
        domain: undefined,
        enrichmentStatus: undefined,
        sort: "newest",
        page: 1,
      });
  });
  it("round trips canonical filters without default noise", () => {
    const params = librarySearchParams({
      q: "deno",
      state: "inbox",
      visibility: "public",
      domain: "deno.com",
      enrichmentStatus: "ready",
      sort: "newest",
      page: 1,
    });
    expect(params.toString()).toBe(
      "q=deno&state=inbox&visibility=public&domain=deno.com&status=ready",
    );
    expect(parseLibrarySearch(params).q).toBe("deno");
  });
});
