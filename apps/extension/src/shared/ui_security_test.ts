import { assertEquals } from "@std/assert";
import {
  escapeHtml,
  safeDiscordMessageUrl,
  safeWebUrl,
} from "./ui_security.ts";

Deno.test("hostile UI text is escaped and unsafe links are rejected", () => {
  assertEquals(
    escapeHtml('<img src=x onerror="alert(1)">\'&'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;",
  );
  assertEquals(safeWebUrl("javascript:alert(1)"), null);
  assertEquals(safeWebUrl("data:text/html,pwned"), null);
  assertEquals(safeWebUrl("https://user:secret@example.com"), null);
  assertEquals(
    safeWebUrl("https://example.com/post"),
    "https://example.com/post",
  );
  assertEquals(
    safeDiscordMessageUrl("https://discord.com/channels/1/2/3"),
    "https://discord.com/channels/1/2/3",
  );
  assertEquals(
    safeDiscordMessageUrl("https://evil.example/channels/1/2/3"),
    null,
  );
  assertEquals(
    safeDiscordMessageUrl("https://discord.com/oauth2/authorize"),
    null,
  );
});
