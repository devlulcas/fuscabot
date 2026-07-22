import { chat, StandardSchemaValidationError } from "@tanstack/ai";
import { createMistralText, type MistralChatModels } from "@tanstack/ai-mistral";
import { type EnrichmentDraft, EnrichmentDraftSchema } from "@fuscabot/contracts";
import { ENRICHMENT_PROMPT_VERSION, type EnrichmentInput } from "../domain/enrichment.ts";
import { logWarn } from "../observability/log.ts";

type EnrichmentGenerator = (input: EnrichmentInput) => Promise<EnrichmentDraft>;

export type MistralClientOptions = {
  apiKey: string;
  model?: MistralChatModels;
  timeoutMs?: number;
  generate?: EnrichmentGenerator;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class MistralClientError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "rate_limited" | "authentication" | "upstream" | "malformed",
    readonly retryable: boolean,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MistralClientError";
  }
}

export class MistralClient {
  readonly #generate: EnrichmentGenerator;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(options: MistralClientOptions) {
    this.#sleep = options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    if (options.generate) {
      this.#generate = options.generate;
      return;
    }
    const model = options.model ?? "mistral-small-latest";
    const adapter = createMistralText(model, options.apiKey, {
      timeoutMs: options.timeoutMs ?? 12_000,
    });
    this.#generate = (input) =>
      chat({
        adapter,
        systemPrompts: [systemPrompt()],
        messages: [{ role: "user", content: JSON.stringify(input) }],
        outputSchema: EnrichmentDraftSchema,
        modelOptions: { temperature: 0.2 },
      });
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentDraft> {
    let firstFailure: MistralClientError | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return EnrichmentDraftSchema.parse(await this.#generate(input));
      } catch (cause) {
        const failure = classifyError(cause);
        if (!failure.retryable || attempt === 1) throw failure;
        firstFailure = failure;
        logWarn("ai_request_retry", {
          provider: "mistral",
          attempt: attempt + 1,
          code: failure.code,
          status: failure.status,
          delayMs: 250,
        });
        await this.#sleep(250);
      }
    }
    throw firstFailure ?? new MistralClientError("Mistral request failed", "upstream", true);
  }
}

function systemPrompt(): string {
  return `${ENRICHMENT_PROMPT_VERSION}
Draft concise context for a private link library. Respect outputLanguage. Never publish or invent facts.
Use only supplied tag slugs in suggestedTagSlugs and supplied UUID channel IDs in channelSuggestion.channelId. Put novel bilingual tags in proposedNewTags. If routing confidence is low, channelId must be null.`;
}

function classifyError(cause: unknown): MistralClientError {
  if (cause instanceof MistralClientError) return cause;
  if (cause instanceof StandardSchemaValidationError || isZodError(cause)) {
    return new MistralClientError(
      "Mistral response did not match the enrichment schema",
      "malformed",
      true,
      undefined,
      { cause },
    );
  }
  const status = findStatus(cause);
  if (status === 401 || status === 403) {
    return new MistralClientError(
      "Mistral authentication failed",
      "authentication",
      false,
      status,
      { cause },
    );
  }
  if (status === 429) {
    return new MistralClientError(
      "Mistral rate limit reached",
      "rate_limited",
      true,
      status,
      { cause },
    );
  }
  if (isTimeoutError(cause)) {
    return new MistralClientError("Mistral request timed out", "timeout", true, status, { cause });
  }
  return new MistralClientError(
    "Mistral request failed",
    "upstream",
    status === undefined || status >= 500,
    status,
    { cause },
  );
}

function numericProperty(value: unknown, name: string): number | undefined {
  if (typeof value !== "object" || value === null || !(name in value)) return undefined;
  const property = (value as Record<string, unknown>)[name];
  if (typeof property === "number") return property;
  if (typeof property === "string" && /^\d{3}$/.test(property)) return Number(property);
  return undefined;
}

function findStatus(value: unknown, depth = 0): number | undefined {
  if (depth > 3 || typeof value !== "object" || value === null) return undefined;
  const direct = numericProperty(value, "statusCode") ?? numericProperty(value, "status");
  if (direct !== undefined) return direct;
  const record = value as Record<string, unknown>;
  return findStatus(record.response, depth + 1) ?? findStatus(record.cause, depth + 1);
}

function isTimeoutError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  return cause.name === "TimeoutError" || cause.name === "AbortError" ||
    /timed?\s*out|timeout/i.test(cause.message);
}

function isZodError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "ZodError";
}
