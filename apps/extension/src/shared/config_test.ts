import { assertEquals } from "@std/assert";
import { normalizeBaseUrl } from "./config.ts";
import { capturePath, cleanOptionalText } from "./types.ts";

Deno.test("normalizes API origins", () => {
  assertEquals(normalizeBaseUrl("https://example.com/"), "https://example.com");
  assertEquals(
    normalizeBaseUrl("javascript:alert(1)"),
    "http://localhost:8000",
  );
});
Deno.test("cleans optional capture text", () => {
  assertEquals(cleanOptionalText("  hello\n world "), "hello world");
  assertEquals(cleanOptionalText("   "), null);
});
Deno.test("encodes capture routes", () =>
  assertEquals(capturePath("a/b"), "/capture/a%2Fb"));
