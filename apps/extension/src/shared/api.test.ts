import { expect, it } from "vitest";
import {
  ContractResponseError,
  parseBulkResourceResult,
  parseDeliveryResult,
  parsePublicationResult,
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
  personalNote: null,
  enrichmentStatus: "preparing",
  enrichmentError: null,
  publicPublication: null,
  tags: [],
  createdAt: "2026-07-20T12:00:00Z",
  updatedAt: "2026-07-20T12:00:00Z",
};

it("resource response parsing validates envelopes and preserves channels", () => {
  const publicPublication = {
    slug: "post-abcd1234",
    publishedAt: "2026-07-20T13:00:00Z",
    url: "https://example.com/en/links/post-abcd1234",
  };
  const parsed = parseResourceEnvelope({
    data: {
      ...resource,
      publicPublication,
      channels: [{ id: "channel-1", name: "links" }],
    },
  });
  expect(parsed.publicPublication).toEqual({
    ...publicPublication,
    publishedAt: "2026-07-20T13:00:00.000Z",
  });
  expect(parsed.createdAt).toBe("2026-07-20T12:00:00.000Z");
  expect(parsed.updatedAt).toBe("2026-07-20T12:00:00.000Z");
  expect(parsed.channels).toEqual([{ id: "channel-1", name: "links" }]);
  expect(parseResourceListEnvelope({ data: [resource] }).length).toBe(1);
  expect(
    parseResourcePageEnvelope({
      data: [resource],
      meta: { limit: 25, offset: 0, hasMore: false },
    }).pageInfo.hasMore,
  ).toBe(false);
  expect(
    () =>
      parseResourceEnvelope({
        data: { ...resource, originalUrl: "file:///tmp/a" },
      }),
  ).toThrow(ContractResponseError);
});

it("delivery parsing accepts the contract and maps external URL", () => {
  expect(
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
  ).toEqual({ discordUrl: "https://discord.com/channels/1/2/3" });
});

it("bulk resource result parsing validates action and ids", () => {
  expect(
    parseBulkResourceResult({
      data: { action: "delete", affectedIds: [resource.id] },
    }),
  ).toEqual({ action: "delete", affectedIds: [resource.id] });
  expect(
    () =>
      parseBulkResourceResult({
        data: { action: "move", affectedIds: [resource.id] },
      }),
  ).toThrow(ContractResponseError);
});

it("publication parsing preserves independent target outcomes", () => {
  expect(
    parsePublicationResult({
      data: {
        website: {
          status: "published",
          retryable: false,
          url: "https://example.com/en/links/post-abcd1234",
          deliveryId: null,
          error: null,
        },
        discord: {
          status: "failed",
          retryable: true,
          url: null,
          deliveryId: "019432f0-7c00-7000-8000-000000000004",
          error: "Discord was temporarily unavailable",
        },
      },
    }),
  ).toEqual({
    website: {
      status: "published",
      retryable: false,
      url: "https://example.com/en/links/post-abcd1234",
    },
    discord: {
      status: "failed",
      retryable: true,
      deliveryId: "019432f0-7c00-7000-8000-000000000004",
      error: "Discord was temporarily unavailable",
    },
  });
  expect(
    () =>
      parsePublicationResult({
        data: {
          website: { status: "unknown", retryable: false },
          discord: { status: "not_requested", retryable: false },
        },
      }),
  ).toThrow(ContractResponseError);
});
