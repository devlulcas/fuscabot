import { expect, it } from "vitest";
import {
  escapeHtml,
  safeDiscordMessageUrl,
  safeWebUrl,
} from "./ui_security.ts";

it("hostile UI text is escaped and unsafe links are rejected", () => {
  expect(
    escapeHtml('<img src=x onerror="alert(1)">\'&'),
  ).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;");
  expect(safeWebUrl("javascript:alert(1)")).toBeNull();
  expect(safeWebUrl("data:text/html,pwned")).toBeNull();
  expect(safeWebUrl("https://user:secret@example.com")).toBeNull();
  expect(safeWebUrl("https://example.com/post")).toBe(
    "https://example.com/post",
  );
  expect(safeDiscordMessageUrl("https://discord.com/channels/1/2/3")).toBe(
    "https://discord.com/channels/1/2/3",
  );
  expect(safeDiscordMessageUrl("https://evil.example/channels/1/2/3"))
    .toBeNull();
  expect(safeDiscordMessageUrl("https://discord.com/oauth2/authorize"))
    .toBeNull();
});
