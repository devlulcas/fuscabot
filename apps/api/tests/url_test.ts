import { assertEquals } from "@std/assert";
import { normalizeUrl, trustedCanonical } from "../src/domain/url.ts";
Deno.test("normalization preserves meaningful parameters and fragments", () =>
  assertEquals(
    normalizeUrl("HTTPS://Example.COM:443/a?utm_medium=x&q=deno#part"),
    "https://example.com/a?q=deno#part",
  ));
Deno.test("canonical URL cannot cross hosts", () => {
  assertEquals(trustedCanonical("https://example.com/a", "https://evil.test/a"), null);
  assertEquals(
    trustedCanonical("https://www.example.com/a", "https://example.com/a"),
    "https://example.com/a",
  );
});
