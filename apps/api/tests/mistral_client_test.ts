import { assertEquals, assertInstanceOf } from "@std/assert";
import type { EnrichmentDraft } from "../../../packages/contracts/mod.ts";
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

Deno.test("Mistral client parses a strict enrichment draft", async () => {
  let request: RequestInit | undefined;
  const client = new MistralClient({
    apiKey: "secret",
    fetch: (_url, init) => {
      request = init;
      return Promise.resolve(
        Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] }),
      );
    },
  });
  assertEquals(await client.enrich(input), draft);
  assertEquals(JSON.parse(String(request?.body)).messages[1].content.includes(input.version), true);
});

Deno.test("malformed structured output is non-retryable", async () => {
  const client = new MistralClient({
    apiKey: "secret",
    fetch: () =>
      Promise.resolve(Response.json({ choices: [{ message: { content: '{"summary":1}' } }] })),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertInstanceOf(error, MistralClientError);
  assertEquals([error.code, error.retryable], ["malformed", false]);
});

Deno.test("rate limits are retryable", async () => {
  const client = new MistralClient({
    apiKey: "secret",
    fetch: () => Promise.resolve(new Response(null, { status: 429 })),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertEquals([error.code, error.retryable, error.status], ["rate_limited", true, 429]);
});

Deno.test("request timeout aborts injected fetch", async () => {
  const client = new MistralClient({
    apiKey: "secret",
    timeoutMs: 5,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
      ),
  });
  const error = await client.enrich(input).catch((error) => error);
  assertEquals([error.code, error.retryable], ["timeout", true]);
});
