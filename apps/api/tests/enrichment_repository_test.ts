import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { compactEnrichmentInput } from "../src/domain/enrichment.ts";
import {
  CLAIM_RUN_SQL,
  COMPLETE_FAILED_SQL,
  COMPLETE_READY_SQL,
  LATEST_RUN_SQL,
  PostgresEnrichmentStore,
  type SqlQuery,
} from "../src/repositories/enrichment_repository.ts";

const resourceId = "019432f0-7c00-7000-8000-000000000001";
const input = compactEnrichmentInput({
  title: "Title",
  url: "https://example.com",
  description: null,
  selectedQuote: null,
  sourceLanguage: "en",
  outputLanguage: "pt-BR",
  availableTags: [],
  availableChannels: [],
});
const draft = {
  summary: "Resumo",
  whyUseful: "Útil",
  outputLanguage: "pt-BR" as const,
  suggestedTagSlugs: [],
  proposedNewTags: [],
  channelSuggestion: { channelId: null, confidence: "low" as const, reason: "Manual" },
  includeQuoteInDelivery: false,
};
function row(status: "preparing" | "ready" | "failed", output: unknown = null) {
  return {
    resource_id: resourceId,
    input_snapshot: input,
    output,
    status,
    error: null,
    retryable: false,
    prompt_version: "resource-enrichment-prompt/v1",
    attempt: 1,
  };
}

Deno.test("Postgres store persists claim before completing resource", async () => {
  const calls: Array<{ sql: string; args?: unknown[] }> = [];
  const query: SqlQuery = {
    queryObject<T>(sql: string, args?: unknown[]) {
      calls.push({ sql, args });
      const rows = sql === LATEST_RUN_SQL
        ? []
        : sql === CLAIM_RUN_SQL
        ? [row("preparing")]
        : [row("ready", draft)];
      return Promise.resolve({ rows: rows as T[] });
    },
  };
  const store = new PostgresEnrichmentStore(query, "mistral-small-latest");
  assertEquals((await store.claim(resourceId, input)).claimed, true);
  assertEquals((await store.completeReady(resourceId, draft)).status, "ready");
  assertEquals(calls.map((call) => call.sql), [LATEST_RUN_SQL, CLAIM_RUN_SQL, COMPLETE_READY_SQL]);
  assertEquals(JSON.parse(String(calls[1].args?.[3])).version, input.version);
  assertEquals(JSON.parse(String(calls[2].args?.[1])).summary, "Resumo");
});

Deno.test("Postgres store reports a lost completion claim", async () => {
  const query: SqlQuery = {
    queryObject<T>() {
      return Promise.resolve({ rows: [] as T[] });
    },
  };
  const store = new PostgresEnrichmentStore(query, "model");
  const error = await store.completeFailed(resourceId, "safe", true).catch((cause) => cause);
  assert(error instanceof Error);
  assertEquals(error.message, "Enrichment claim was lost");
});

Deno.test("SQL protocol atomically gates and finalizes resource state", () => {
  assertStringIncludes(CLAIM_RUN_SQL, "ON CONFLICT DO NOTHING");
  assertStringIncludes(CLAIM_RUN_SQL, "enrichment_status = 'preparing'");
  assertStringIncludes(COMPLETE_READY_SQL, "enrichment_status = 'ready'");
  assertStringIncludes(COMPLETE_READY_SQL, "summary = $3");
  assertStringIncludes(COMPLETE_FAILED_SQL, "enrichment_status = 'failed'");
});
