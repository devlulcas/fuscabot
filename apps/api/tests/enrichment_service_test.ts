import { assertEquals } from "@std/assert";
import type { EnrichmentDraft } from "../../../packages/contracts/mod.ts";
import { compactEnrichmentInput, type EnrichmentState } from "../src/domain/enrichment.ts";
import { MistralClientError } from "../src/integrations/mistral_client.ts";
import { EnrichmentService, InMemoryEnrichmentStore } from "../src/services/enrichment_service.ts";

const resourceId = "019432f0-7c00-7000-8000-000000000001";
const draft: EnrichmentDraft = {
  summary: "Resumo",
  whyUseful: "Útil",
  outputLanguage: "pt-BR",
  suggestedTagSlugs: [],
  proposedNewTags: [],
  channelSuggestion: { channelId: null, confidence: "low", reason: "Escolha manual" },
  includeQuoteInDelivery: false,
};
function initial(): EnrichmentState {
  return {
    resourceId,
    input: compactEnrichmentInput({
      title: "Title",
      url: "https://example.com",
      description: null,
      selectedQuote: null,
      sourceLanguage: "en",
      outputLanguage: "pt-BR",
      availableTags: [],
      availableChannels: [],
    }),
    status: "preparing",
    attempt: 0,
    draft: null,
    error: null,
    retryable: false,
    promptVersion: null,
  };
}

Deno.test("service makes concurrent preparation idempotent", async () => {
  const store = new InMemoryEnrichmentStore([initial()]);
  let calls = 0;
  const service = new EnrichmentService(store, {
    enrich: async () => {
      calls++;
      await Promise.resolve();
      return draft;
    },
  });
  const [one, two] = await Promise.all([service.prepare(resourceId), service.prepare(resourceId)]);
  assertEquals(calls, 1);
  assertEquals(one.status, "ready");
  assertEquals(two, one);
});

Deno.test("failure retains manual fallback input and explicit retry succeeds", async () => {
  const state = initial();
  state.draft = { ...draft, summary: "User-authored fallback" };
  const store = new InMemoryEnrichmentStore([state]);
  let calls = 0;
  const service = new EnrichmentService(store, {
    enrich: () => {
      calls++;
      if (calls === 1) throw new MistralClientError("Rate limited", "rate_limited", true, 429);
      return Promise.resolve(draft);
    },
  });
  const failed = await service.prepare(resourceId);
  assertEquals([failed.status, failed.retryable, failed.draft?.summary], [
    "failed",
    true,
    "User-authored fallback",
  ]);
  const ready = await service.retry(resourceId);
  assertEquals([ready.status, ready.attempt, calls], ["ready", 2, 2]);
  assertEquals((await service.retry(resourceId)).attempt, 2);
});
