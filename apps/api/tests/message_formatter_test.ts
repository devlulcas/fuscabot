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
  whyUseful: "It explains how to separate resources from outbound messages.",
  personalNote: "Use this when revisiting the bot architecture.",
  enrichmentStatus: "ready",
  enrichmentError: null,
  archivedAt: null,
  tags: ["typescript", "browser-extension"].map((slug) => ({
    slug,
    labels: [{ language: "en" as const, name: slug }],
    aliases: [],
    source: "user" as const,
  })),
  createdAt: "2026-07-21T14:30:00Z",
  updatedAt: "2026-07-21T14:30:00Z",
};

Deno.test("rich delivery snapshot follows the visual hierarchy", () => {
  const snapshot = formatDiscordSnapshot(resource, "share", "#saved-links");
  DeliverySnapshotV2Schema.parse(snapshot);
  const payload = snapshot.payload;
  const embed = payload.embeds[0];
  assertEquals([snapshot.version, embed.title, embed.url], [
    2,
    resource.title,
    resource.originalUrl,
  ]);
  assertEquals(embed.author, { name: "example.com", url: resource.originalUrl });
  assertEquals(embed.description, resource.summary);
  assertEquals(embed.fields?.map((field) => field.name), [
    "Why save it?",
    "Selected context",
    "Tags",
  ]);
  assertStringIncludes(embed.fields?.[0].value ?? "", "**Your note**");
  assertEquals(embed.fields?.[2].value, "`#typescript` `#browser-extension`");
  assertStringIncludes(embed.footer?.text ?? "", "#saved-links");
  assertEquals(embed.timestamp, resource.createdAt);
  assertEquals(payload.components?.[0].components[0], {
    type: 2,
    style: 5,
    label: "Open link",
    url: resource.originalUrl,
  });
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
    whyUseful: null,
    personalNote: null,
    selectedQuote: null,
    tags: [],
  }, "share");
  const embed = sparse.payload.embeds[0];
  assertEquals(embed.description, undefined);
  assertEquals(embed.fields, undefined);
  assertEquals(sparse.destinationLabel, null);
  assertEquals(embed.footer?.text.includes("#"), false);
});

Deno.test("formatter gracefully truncates every Discord limit and disables mentions", () => {
  const oversized = formatDiscordSnapshot(
    {
      ...resource,
      title: `@everyone ${"😀".repeat(300)}`,
      sourceDomain: "d".repeat(300),
      summary: "s".repeat(8_000),
      whyUseful: "w".repeat(3_000),
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
  const embed = oversized.payload.embeds[0];
  const aggregate = embed.title.length + (embed.description?.length ?? 0) +
    (embed.author?.name.length ?? 0) + (embed.footer?.text.length ?? 0) +
    (embed.fields?.reduce((sum, field) => sum + field.name.length + field.value.length, 0) ?? 0);
  assert(embed.title.length <= 256);
  assertEquals(/\p{Surrogate}/u.test([...embed.title].at(-2) ?? ""), false);
  assert((embed.description?.length ?? 0) <= 4_096);
  assert(embed.fields?.every((field) => field.name.length <= 256 && field.value.length <= 1_024));
  assert(aggregate <= 6_000);
  assertEquals(DiscordMessagePayloadSchema.safeParse(oversized.payload).success, true);
  assertEquals(oversized.payload.allowed_mentions, { parse: [] });
});

Deno.test("legacy snapshots retain a compatible link-button renderer", () => {
  const payload = snapshotPayload({
    title: "Legacy",
    url: "https://example.com/legacy",
    summary: "Old snapshot",
    whyUseful: null,
    personalNote: null,
    selectedQuote: null,
    includeQuote: false,
    tags: [],
    outputLanguage: "pt-BR",
  });
  assertEquals(payload.components?.[0].components[0].url, "https://example.com/legacy");
  assertEquals(payload.components?.[0].components[0].label, "Abrir link");
  assertEquals(payload.allowed_mentions, { parse: [] });
});
