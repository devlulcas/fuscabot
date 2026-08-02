import { describe, expect, it } from "vitest";
import { pageUrl, parseListQuery, preferredLocale } from "./archive.ts";

describe("archive query parsing", () => {
  it("normalizes supported filters", () => {
    expect(parseListQuery(new URLSearchParams("q=%20useful%20&tag=design&page=2"))).toEqual({
      query: "useful",
      tag: "design",
      page: 2,
    });
    expect(pageUrl("en", { query: "useful", tag: "design", page: 1 })).toBe(
      "/en/?q=useful&tag=design",
    );
  });

  it.each(["private=true", "q=one&q=two", "tag=../private", "page=0", "page=1.5"])(
    "rejects invalid query %s",
    (query) => expect(parseListQuery(new URLSearchParams(query))).toBeNull(),
  );
});

describe("locale negotiation", () => {
  it("selects Brazilian Portuguese by quality and otherwise defaults to English", () => {
    expect(preferredLocale("en;q=.5, pt-BR;q=.9")).toBe("pt-br");
    expect(preferredLocale("pt-PT")).toBe("en");
    expect(preferredLocale(null)).toBe("en");
  });
});
