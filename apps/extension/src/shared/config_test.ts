import { assertEquals } from "@std/assert";
import {
  normalizeAccentColor,
  normalizeBaseUrl,
  normalizeTheme,
} from "./config.ts";
import { capturePath, cleanOptionalText } from "./types.ts";

Deno.test("normalizes API origins", () => {
  assertEquals(
    normalizeBaseUrl("https://example.com/"),
    "https://fuscabot.devlulcas.deno.net",
  );
  assertEquals(
    normalizeBaseUrl("https://api.fuscabot.dev"),
    "https://fuscabot.devlulcas.deno.net",
  );
  assertEquals(
    normalizeBaseUrl("http://localhost:8000/"),
    "http://localhost:8000",
  );
  assertEquals(
    normalizeBaseUrl("javascript:alert(1)"),
    "https://fuscabot.devlulcas.deno.net",
  );
  assertEquals(
    normalizeBaseUrl("http://example.com"),
    "https://fuscabot.devlulcas.deno.net",
  );
  assertEquals(
    normalizeBaseUrl("https://user:secret@example.com"),
    "https://fuscabot.devlulcas.deno.net",
  );
  assertEquals(
    normalizeBaseUrl("https://example.com/api?token=x"),
    "https://fuscabot.devlulcas.deno.net",
  );
});
Deno.test("cleans optional capture text", () => {
  assertEquals(cleanOptionalText("  hello\n world "), "hello world");
  assertEquals(cleanOptionalText("   "), null);
});
Deno.test("encodes capture routes", () =>
  assertEquals(capturePath("a/b"), "/capture/a%2Fb"));
Deno.test("normalizes appearance preferences", () => {
  assertEquals(normalizeTheme("adwaita"), "adwaita");
  assertEquals(normalizeTheme("adwaita-dark"), "adwaita-dark");
  assertEquals(normalizeTheme("system"), "dark");
  assertEquals(normalizeAccentColor("#35A4E8"), "#35a4e8");
  assertEquals(normalizeAccentColor("blue"), undefined);
});
