import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  ApiErrorSchema,
  CaptureSchema,
  EnrichmentDraftSchema,
  ResourceSchema,
} from "./schemas.ts";

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
    whyUseful: "Porque é útil",
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
