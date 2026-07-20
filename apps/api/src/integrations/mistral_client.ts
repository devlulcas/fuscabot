import { type EnrichmentDraft, EnrichmentDraftSchema } from "../../../../packages/contracts/mod.ts";
import { ENRICHMENT_PROMPT_VERSION, type EnrichmentInput } from "../domain/enrichment.ts";

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MistralClientOptions = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
  endpoint?: string;
};

export class MistralClientError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "rate_limited" | "authentication" | "upstream" | "malformed",
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MistralClientError";
  }
}

export class MistralClient {
  readonly #fetch: FetchLike;
  readonly #endpoint: string;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #apiKey: string;

  constructor(options: MistralClientOptions) {
    this.#fetch = options.fetch ?? fetch;
    this.#endpoint = options.endpoint ?? ENDPOINT;
    this.#model = options.model ?? "mistral-small-latest";
    this.#timeoutMs = options.timeoutMs ?? 12_000;
    this.#apiKey = options.apiKey;
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentDraft> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Timed out", "TimeoutError")),
      this.#timeoutMs,
    );
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${this.#apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.#model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: JSON.stringify(input) },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw classifyStatus(response.status);
      return await parseResponse(response);
    } catch (error) {
      if (error instanceof MistralClientError) throw error;
      if (controller.signal.aborted || isAbortError(error)) {
        throw new MistralClientError("Mistral request timed out", "timeout", true);
      }
      throw new MistralClientError("Mistral request failed", "upstream", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function systemPrompt(): string {
  return `${ENRICHMENT_PROMPT_VERSION}\nReturn JSON only. Draft concise context for a private link library. Respect outputLanguage. Use only supplied tag slugs and channel IDs; propose bilingual tags separately. Never publish. Low confidence requires channelId null. Required keys: summary, whyUseful, outputLanguage, suggestedTagSlugs, proposedNewTags, channelSuggestion, includeQuoteInDelivery.`;
}

async function parseResponse(response: Response): Promise<EnrichmentDraft> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw malformed("Mistral returned non-JSON data");
  }
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw malformed("Mistral response omitted message content");
  let draft: unknown;
  try {
    draft = JSON.parse(content);
  } catch {
    throw malformed("Mistral message content was not JSON");
  }
  const parsed = EnrichmentDraftSchema.safeParse(draft);
  if (!parsed.success) throw malformed("Mistral response did not match the enrichment schema");
  return parsed.data;
}

function classifyStatus(status: number): MistralClientError {
  if (status === 429) {
    return new MistralClientError("Mistral rate limit reached", "rate_limited", true, status);
  }
  if (status === 401 || status === 403) {
    return new MistralClientError("Mistral authentication failed", "authentication", false, status);
  }
  return new MistralClientError("Mistral upstream error", "upstream", status >= 500, status);
}

function malformed(message: string): MistralClientError {
  return new MistralClientError(message, "malformed", false);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
