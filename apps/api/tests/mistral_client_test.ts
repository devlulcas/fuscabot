import { assertEquals, assertInstanceOf } from "@std/assert";
import type { EnrichmentDraft } from "@fuscabot/contracts";
import { compactEnrichmentInput } from "../src/domain/enrichment.ts";
import { MistralClient, MistralClientError } from "../src/integrations/mistral_client.ts";

const input = compactEnrichmentInput({
  title: "A useful page",
  url: "https://example.com",
  description: "Description",
  selectedQuote: null,
  sourceLanguage: "en",
  outputLanguage: "pt-BR",
  availableTags: [],
  availableChannels: [],
});
const draft: EnrichmentDraft = {
  summary: "Resumo útil",
  whyUseful: "Ajuda a compreender o tema",
  outputLanguage: "pt-BR",
  suggestedTagSlugs: [],
  proposedNewTags: [],
  channelSuggestion: { channelId: null, confidence: "low", reason: "Sem canal adequado" },
  includeQuoteInDelivery: false,
};

Deno.test("Mistral client accepts a strict enrichment draft", async () => {
  const client = new MistralClient({ apiKey: "secret", generate: () => Promise.resolve(draft) });
  assertEquals(await client.enrich(input), draft);
});

Deno.test("schema failures retry once and can recover", async () => {
  let calls = 0;
  const client = new MistralClient({
    apiKey: "secret",
    generate: () => Promise.resolve(++calls === 1 ? { ...draft, summary: "" } : draft),
    sleep: () => Promise.resolve(),
  });
  assertEquals(await client.enrich(input), draft);
  assertEquals(calls, 2);
});

Deno.test("exhausted malformed structured output is retryable", async () => {
  let calls = 0;
  const client = new MistralClient({
    apiKey: "secret",
    generate: () => {
      calls++;
      return Promise.resolve({ ...draft, summary: "" });
    },
    sleep: () => Promise.resolve(),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertInstanceOf(error, MistralClientError);
  assertEquals([error.code, error.retryable, calls], ["malformed", true, 2]);
});

Deno.test("rate limits retry once", async () => {
  let calls = 0;
  const client = new MistralClient({
    apiKey: "secret",
    generate: () => {
      calls++;
      return Promise.reject(new MistralClientError("Rate limited", "rate_limited", true, 429));
    },
    sleep: () => Promise.resolve(),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertEquals([error.code, error.retryable, error.status, calls], ["rate_limited", true, 429, 2]);
});

Deno.test("authentication failures are not retried", async () => {
  let calls = 0;
  const client = new MistralClient({
    apiKey: "secret",
    generate: () => {
      calls++;
      return Promise.reject(new MistralClientError("No", "authentication", false, 401));
    },
    sleep: () => Promise.resolve(),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertEquals([error.code, error.retryable, error.status, calls], [
    "authentication",
    false,
    401,
    1,
  ]);
});

Deno.test("timeout failures retry once", async () => {
  let calls = 0;
  const client = new MistralClient({
    apiKey: "secret",
    generate: () => {
      calls++;
      return Promise.reject(new DOMException("Timed out", "TimeoutError"));
    },
    sleep: () => Promise.resolve(),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertEquals([error.code, error.retryable, calls], ["timeout", true, 2]);
});
