import type { EnrichmentDraft } from "../../../../packages/contracts/mod.ts";

export const ENRICHMENT_INPUT_VERSION = "resource-enrichment-input/v1" as const;
export const ENRICHMENT_PROMPT_VERSION = "resource-enrichment-prompt/v2" as const;

export type EnrichmentInput = {
  version: typeof ENRICHMENT_INPUT_VERSION;
  title: string;
  url: string;
  description: string | null;
  selectedQuote: string | null;
  sourceLanguage: string;
  outputLanguage: "pt-BR" | "en";
  availableTags: Array<{ slug: string; english: string; portuguese: string }>;
  availableChannels: Array<{ id: string; name: string; routingDescription: string | null }>;
};

export type EnrichmentState = {
  resourceId: string;
  input: EnrichmentInput;
  status: "preparing" | "ready" | "failed";
  attempt: number;
  draft: EnrichmentDraft | null;
  error: string | null;
  retryable: boolean;
  promptVersion: typeof ENRICHMENT_PROMPT_VERSION | null;
};

export type EnrichmentClaim = { state: EnrichmentState; claimed: boolean };

export function compactEnrichmentInput(
  input: Omit<EnrichmentInput, "version">,
): EnrichmentInput {
  return {
    version: ENRICHMENT_INPUT_VERSION,
    ...input,
    title: compact(input.title, 500) ?? "Untitled resource",
    description: compact(input.description, 2_000),
    selectedQuote: compact(input.selectedQuote, 2_000),
    availableTags: input.availableTags.slice(0, 100),
    availableChannels: input.availableChannels.slice(0, 100).map((channel) => ({
      ...channel,
      routingDescription: compact(channel.routingDescription, 500),
    })),
  };
}

function compact(value: string | null, limit: number): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit) : null;
}
