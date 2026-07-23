import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  ApiErrorSchema,
  BulkResourceActionSchema,
  CaptureSchema,
  DeliverySnapshotSchema,
  DeliverySnapshotV2Schema,
  EnrichmentDraftSchema,
  ResourceSchema,
} from "./schemas.ts";

Deno.test("bulk resource actions require unique UUIDs", () => {
  const id = "01980000-7000-8000-8000-000000000001";
  assert(
    BulkResourceActionSchema.safeParse({ ids: [id], action: "delete" })
      .success,
  );
  assertFalse(
    BulkResourceActionSchema.safeParse({ ids: [id, id], action: "delete" })
      .success,
  );
  assertFalse(
    BulkResourceActionSchema.safeParse({ ids: [], action: "delete" }).success,
  );
});

Deno.test("capture defaults optional metadata safely", () => {
  const capture = CaptureSchema.parse({
    captureId: "01980000-7000-8000-8000-000000000001",
    url: "https://example.com/article",
    title: "An article",
  });
  assertEquals(capture.selectedQuote, null);
  assertEquals(capture.metadata.canonicalUrl, null);
});

Deno.test("resource and capture contracts reject non-web and credential URLs", () => {
  assertFalse(
    CaptureSchema.safeParse({
      captureId: "01980000-7000-8000-8000-000000000001",
      url: "file:///private/document",
      title: "Private file",
    }).success,
  );
  assertFalse(
    CaptureSchema.safeParse({
      captureId: "01980000-7000-8000-8000-000000000001",
      url: "https://user:secret@example.com/document",
      title: "Credential URL",
    }).success,
  );
  assertFalse(
    ResourceSchema.shape.imageUrl.safeParse("data:image/png;base64,AA==")
      .success,
  );
});

Deno.test("enrichment contract caps tags and prevents low confidence preselection", () => {
  const base = {
    summary: "Resumo",
    outputLanguage: "pt-BR",
    suggestedTagSlugs: ["deno"],
    proposedNewTags: [],
    channelSuggestion: {
      channelId: null,
      confidence: "low",
      reason: "Sem contexto suficiente",
    },
    includeQuoteInDelivery: false,
  };
  assert(EnrichmentDraftSchema.safeParse(base).success);
  assertFalse(
    EnrichmentDraftSchema.safeParse({
      ...base,
      channelSuggestion: {
        ...base.channelSuggestion,
        channelId: "01980000-7000-8000-8000-000000000002",
      },
    }).success,
  );
  assertFalse(
    EnrichmentDraftSchema.safeParse({
      ...base,
      suggestedTagSlugs: Array.from(
        { length: 9 },
        (_, index) => `tag-${index}`,
      ),
    }).success,
  );
});

Deno.test("API errors have a stable envelope", () => {
  const result = ApiErrorSchema.parse({
    error: { code: "CONFLICT", message: "Resource already exists" },
  });
  assertEquals(result.error.retryable, false);
});

Deno.test("delivery snapshots accept legacy rows and validate finalized v2 payloads", () => {
  const legacy = {
    title: "Saved link",
    url: "https://example.com/link",
    summary: null,
    personalNote: null,
    selectedQuote: null,
    includeQuote: false,
    tags: [],
    outputLanguage: "en" as const,
  };
  assert(DeliverySnapshotSchema.safeParse(legacy).success);
  assert(
    DeliverySnapshotV2Schema.safeParse({
      ...legacy,
      version: 2,
      sourceDomain: "example.com",
      capturedAt: "2026-07-21T12:00:00Z",
      destinationLabel: "#saved-links",
      payload: {
        content: "### Saved link\n\n[example.com](https://example.com/link)",
        allowed_mentions: { parse: [] },
      },
    }).success,
  );
  assertFalse(
    DeliverySnapshotV2Schema.safeParse({
      ...legacy,
      version: 2,
      sourceDomain: "example.com",
      capturedAt: "2026-07-21T12:00:00Z",
      destinationLabel: null,
      payload: {
        content: "x".repeat(2_001),
        allowed_mentions: { parse: [] },
      },
    }).success,
  );
  assertFalse(
    DeliverySnapshotV2Schema.safeParse({
      ...legacy,
      version: 2,
      sourceDomain: "example.com",
      capturedAt: "2026-07-21T12:00:00Z",
      destinationLabel: null,
      payload: {
        content: "",
        allowed_mentions: { parse: [] },
      },
    }).success,
  );
});
