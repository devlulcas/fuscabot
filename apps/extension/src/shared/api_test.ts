import { assertEquals, assertThrows } from "@std/assert";
import {
  ContractResponseError,
  parseBulkResourceResult,
  parseDeliveryResult,
  parseResourceEnvelope,
  parseResourceListEnvelope,
  parseResourcePageEnvelope,
} from "./api.ts";

const resource = {
  id: "019432f0-7c00-7000-8000-000000000001",
  originalUrl: "https://example.com/post",
  normalizedUrl: "https://example.com/post",
  canonicalUrl: null,
  canonicalUrlKey: "https://example.com/post",
  sourceDomain: "example.com",
  sourceLanguage: "en",
  outputLanguage: "pt-BR",
  title: "Post",
  description: null,
  siteName: null,
  author: null,
  publishedAtSource: null,
  imageUrl: null,
  selectedQuote: null,
  summary: null,
  whyUseful: null,
  personalNote: null,
  enrichmentStatus: "preparing",
  enrichmentError: null,
  archivedAt: null,
  tags: [],
  createdAt: "2026-07-20T12:00:00Z",
  updatedAt: "2026-07-20T12:00:00Z",
};

Deno.test("resource response parsing validates envelopes and preserves channels", () => {
  assertEquals(
    parseResourceEnvelope({
      data: { ...resource, channels: [{ id: "channel-1", name: "links" }] },
    }).channels,
    [{ id: "channel-1", name: "links" }],
  );
  assertEquals(parseResourceListEnvelope({ data: [resource] }).length, 1);
  assertEquals(
    parseResourcePageEnvelope({
      data: [resource],
      meta: { limit: 25, offset: 0, hasMore: false },
    }).pageInfo.hasMore,
    false,
  );
  assertThrows(
    () =>
      parseResourceEnvelope({
        data: { ...resource, originalUrl: "file:///tmp/a" },
      }),
    ContractResponseError,
  );
});

Deno.test("delivery parsing accepts the contract and maps external URL", () => {
  assertEquals(
    parseDeliveryResult({
      data: {
        id: "019432f0-7c00-7000-8000-000000000002",
        resourceId: resource.id,
        destinationType: "discord_channel",
        channelId: "019432f0-7c00-7000-8000-000000000003",
        deliveryKind: "share",
        messageSnapshot: {
          title: "Post",
          url: resource.originalUrl,
          summary: null,
          whyUseful: null,
          personalNote: null,
          selectedQuote: null,
          includeQuote: false,
          tags: [],
          outputLanguage: "pt-BR",
        },
        externalMessageId: "123",
        externalUrl: "https://discord.com/channels/1/2/3",
        status: "sent",
        error: null,
        sentAt: "2026-07-20T12:00:00Z",
        createdAt: "2026-07-20T12:00:00Z",
      },
    }),
    { discordUrl: "https://discord.com/channels/1/2/3" },
  );
});

Deno.test("bulk resource result parsing validates action and ids", () => {
  assertEquals(
    parseBulkResourceResult({
      data: { action: "archive", affectedIds: [resource.id] },
    }),
    { action: "archive", affectedIds: [resource.id] },
  );
  assertThrows(
    () =>
      parseBulkResourceResult({
        data: { action: "move", affectedIds: [resource.id] },
      }),
    ContractResponseError,
  );
});
