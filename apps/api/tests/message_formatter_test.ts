import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { DeliverySnapshotV2Schema, DiscordMessagePayloadSchema } from "@fuscabot/contracts";
import type { Resource } from "../src/domain/resource.ts";
import { formatDiscordSnapshot, snapshotPayload } from "../src/services/message_formatter.ts";

const resource: Resource = {
  id: crypto.randomUUID(),
  workspaceId: crypto.randomUUID(),
  originalUrl: "https://example.com/articles/deno",
  normalizedUrl: "https://example.com/articles/deno",
  canonicalUrl: null,
  canonicalUrlKey: "https://example.com/articles/deno",
  sourceDomain: "example.com",
  sourceLanguage: "en",
  outputLanguage: "en",
  title: "A practical Deno architecture",
  description: null,
  siteName: null,
  author: null,
  publishedAtSource: null,
  imageUrl: null,
  selectedQuote: "Keep delivery snapshots immutable.",
  summary: "A concise guide to durable delivery boundaries.",
  personalNote: "Use this when revisiting the bot architecture.",
  enrichmentStatus: "ready",
  enrichmentError: null,
  publicPublication: null,
  tags: ["typescript", "browser-extension"].map((slug) => ({
    slug,
    labels: [{ language: "en" as const, name: slug }],
    aliases: [],
    source: "user" as const,
  })),
  createdAt: "2026-07-21T14:30:00Z",
  updatedAt: "2026-07-21T14:30:00Z",
};

Deno.test("delivery snapshot uses a normal markdown message", () => {
  const snapshot = formatDiscordSnapshot(resource, "share", "#saved-links");
  DeliverySnapshotV2Schema.parse(snapshot);
  const payload = snapshot.payload;
  assertEquals(snapshot.version, 2);
  assertEquals(
    payload.content,
    `### A practical Deno architecture

A concise guide to durable delivery boundaries.

> "Keep delivery snapshots immutable."

_Use this when revisiting the bot architecture._

Tags:
- typescript
- browser-extension

[example.com](https://example.com/articles/deno)`,
  );
  assertEquals(payload.allowed_mentions, { parse: [] });
});

Deno.test("Read Later uses the same rich content as a normal share", () => {
  const share = formatDiscordSnapshot(resource, "share", "#read-later");
  const readLater = formatDiscordSnapshot(resource, "read_later", "#read-later");
  assertEquals(readLater.payload, share.payload);
  assertEquals(readLater.tags, ["typescript", "browser-extension"]);
  assertEquals(readLater.personalNote, resource.personalNote);
});

Deno.test("sparse delivery omits empty optional sections", () => {
  const sparse = formatDiscordSnapshot({
    ...resource,
    summary: null,
    personalNote: null,
    selectedQuote: null,
    tags: [],
  }, "share");
  assertEquals(
    sparse.payload.content,
    "### A practical Deno architecture\n\n[example.com](https://example.com/articles/deno)",
  );
  assertEquals(sparse.destinationLabel, null);
});

Deno.test("formatter gracefully truncates every Discord limit and disables mentions", () => {
  const oversized = formatDiscordSnapshot(
    {
      ...resource,
      title: `@everyone ${"😀".repeat(300)}`,
      sourceDomain: "d".repeat(300),
      summary: "s".repeat(8_000),
      personalNote: "n".repeat(3_000),
      selectedQuote: "q".repeat(3_000),
      tags: Array.from({ length: 8 }, (_, index) => ({
        slug: `tag-${index}-${"x".repeat(80)}`,
        labels: [{ language: "en" as const, name: `Tag ${index}` }],
        aliases: [],
        source: "ai" as const,
      })),
    },
    "share",
    `#${"channel".repeat(30)}`,
  );
  assert(oversized.payload.content.length <= 2_000);
  assertStringIncludes(oversized.payload.content, "### @everyone");
  assertStringIncludes(oversized.payload.content, '> "');
  assertStringIncludes(oversized.payload.content, "Tags:");
  assertStringIncludes(oversized.payload.content, resource.originalUrl);
  assertEquals(DiscordMessagePayloadSchema.safeParse(oversized.payload).success, true);
  assertEquals(oversized.payload.allowed_mentions, { parse: [] });
});

Deno.test("legacy snapshots render as markdown", () => {
  const payload = snapshotPayload({
    title: "Legacy",
    url: "https://example.com/legacy",
    summary: "Old snapshot",
    personalNote: null,
    selectedQuote: null,
    includeQuote: false,
    tags: [],
    outputLanguage: "pt-BR",
  });
  assertEquals(
    payload.content,
    "### Legacy\n\nOld snapshot\n\n[example.com](https://example.com/legacy)",
  );
  assertEquals(payload.allowed_mentions, { parse: [] });
});

Deno.test("formatter keeps the link intact with multiline user content", () => {
  const snapshot = formatDiscordSnapshot({
    ...resource,
    title: "A title\nwith another line",
    summary: "summary\n".repeat(500),
    selectedQuote: "quote\n".repeat(500),
    personalNote: "note\n".repeat(500),
    originalUrl: "https://example.com/an(article)",
  }, "share");
  assert(snapshot.payload.content.length <= 2_000);
  assertStringIncludes(
    snapshot.payload.content,
    "[example.com](https://example.com/an%28article%29)",
  );
  assertEquals(snapshot.payload.content.endsWith(")"), true);
});
