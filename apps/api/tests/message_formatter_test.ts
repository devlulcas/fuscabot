import { assertEquals } from "@std/assert";
import type { Resource } from "../src/domain/resource.ts";
import { formatDiscordSnapshot } from "../src/services/message_formatter.ts";

const resource: Resource = {
  id: crypto.randomUUID(),
  workspaceId: crypto.randomUUID(),
  originalUrl: "https://example.com",
  normalizedUrl: "https://example.com/",
  canonicalUrl: null,
  canonicalUrlKey: "https://example.com/",
  sourceDomain: "example.com",
  sourceLanguage: "en",
  outputLanguage: "pt-BR",
  title: "x".repeat(300),
  description: null,
  siteName: null,
  author: null,
  imageUrl: null,
  selectedQuote: "q".repeat(2000),
  summary: "s".repeat(5000),
  whyUseful: "useful",
  personalNote: null,
  enrichmentStatus: "ready",
  enrichmentError: null,
  archivedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

Deno.test("share formatter respects Discord limits", () => {
  const snapshot = formatDiscordSnapshot(resource, "share", ["Deno", "Architecture"]);
  const embed = snapshot.payload.embeds[0];
  assertEquals(embed.title.length, 256);
  assertEquals(embed.description?.length, 4096);
  assertEquals(
    embed.fields?.every((field) => field.name.length <= 256 && field.value.length <= 1024),
    true,
  );
  const aggregate = embed.title.length + (embed.description?.length ?? 0) +
    (embed.fields?.reduce((sum, field) => sum + field.name.length + field.value.length, 0) ?? 0);
  assertEquals(aggregate <= 6000, true);
  assertEquals(snapshot.payload.allowed_mentions, { parse: [] });
});

Deno.test("read-later snapshot omits usefulness and tags", () => {
  const snapshot = formatDiscordSnapshot(resource, "read_later", ["Deno"]);
  assertEquals(snapshot.payload.embeds[0].fields?.map((field) => field.name), ["Contexto"]);
});
