import { assertEquals, assertThrows } from "@std/assert";
import { canonicalizeUrl, normalizeUrl, selectCanonicalUrl } from "./urls.ts";

Deno.test("normalizeUrl removes only known tracking parameters", () => {
  assertEquals(
    normalizeUrl(
      "HTTPS://Example.COM:443/path?utm_source=x&tab=code&FBCLID=y#install",
    ),
    "https://example.com/path?tab=code#install",
  );
});

Deno.test("normalizeUrl preserves unknown parameters and meaningful fragments", () => {
  assertEquals(
    normalizeUrl("https://example.com/doc?version=2&q=deno#api"),
    "https://example.com/doc?q=deno&version=2#api",
  );
});

Deno.test("normalizeUrl rejects non-web and credential-bearing URLs", () => {
  assertThrows(() => normalizeUrl("javascript:alert(1)"), TypeError);
  assertThrows(
    () => normalizeUrl("https://user:secret@example.com"),
    TypeError,
  );
});

Deno.test("selectCanonicalUrl resolves related relative and subdomain canonicals", () => {
  assertEquals(
    selectCanonicalUrl(
      "https://www.example.com/a/page",
      "/articles/page?utm_medium=social",
    ),
    "https://www.example.com/articles/page",
  );
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "https://docs.example.com/a"),
    "https://docs.example.com/a",
  );
});

Deno.test("selectCanonicalUrl rejects unrelated and unsafe canonicals", () => {
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "https://attacker.test/a"),
    null,
  );
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "mailto:a@example.com"),
    null,
  );
  assertEquals(
    selectCanonicalUrl("https://docs.example.co.uk/a", "https://co.uk/a"),
    null,
  );
});

Deno.test("canonicalizeUrl chooses the accepted canonical as duplicate key", () => {
  assertEquals(
    canonicalizeUrl("https://example.com/a?utm_source=x", "/article"),
    {
      originalUrl: "https://example.com/a?utm_source=x",
      normalizedUrl: "https://example.com/a",
      canonicalUrl: "https://example.com/article",
      canonicalUrlKey: "https://example.com/article",
      sourceDomain: "example.com",
    },
  );
});
