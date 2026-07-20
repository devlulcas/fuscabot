import type { EnrichmentDraft } from "../../../../packages/contracts/mod.ts";
import { ENRICHMENT_PROMPT_VERSION, type EnrichmentState } from "../domain/enrichment.ts";
import { MistralClientError } from "../integrations/mistral_client.ts";

export interface EnrichmentClient {
  enrich(input: EnrichmentState["input"]): Promise<EnrichmentDraft>;
}

export interface EnrichmentStore {
  get(resourceId: string): Promise<EnrichmentState | null>;
  save(state: EnrichmentState): Promise<void>;
}

export class EnrichmentService {
  readonly #running = new Map<string, Promise<EnrichmentState>>();

  constructor(private readonly store: EnrichmentStore, private readonly client: EnrichmentClient) {}

  async prepare(resourceId: string): Promise<EnrichmentState> {
    const state = await this.requireState(resourceId);
    if (state.status === "ready") return state;
    return this.#runOnce(state);
  }

  async retry(resourceId: string): Promise<EnrichmentState> {
    const state = await this.requireState(resourceId);
    if (state.status === "ready") return state;
    return this.#runOnce(state);
  }

  #runOnce(state: EnrichmentState): Promise<EnrichmentState> {
    const active = this.#running.get(state.resourceId);
    if (active) return active;
    const operation = this.#execute(state).finally(() => this.#running.delete(state.resourceId));
    this.#running.set(state.resourceId, operation);
    return operation;
  }

  async #execute(previous: EnrichmentState): Promise<EnrichmentState> {
    const preparing: EnrichmentState = {
      ...previous,
      status: "preparing",
      attempt: previous.attempt + 1,
      error: null,
      retryable: false,
      promptVersion: ENRICHMENT_PROMPT_VERSION,
    };
    await this.store.save(preparing);
    try {
      const draft = await this.client.enrich(preparing.input);
      const ready: EnrichmentState = {
        ...preparing,
        status: "ready",
        draft,
        error: null,
        retryable: false,
      };
      await this.store.save(ready);
      return ready;
    } catch (error) {
      const failure = safeFailure(error);
      const failed: EnrichmentState = {
        ...preparing,
        status: "failed",
        error: failure.message,
        retryable: failure.retryable,
      };
      await this.store.save(failed);
      return failed;
    }
  }

  async requireState(resourceId: string): Promise<EnrichmentState> {
    const state = await this.store.get(resourceId);
    if (!state) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    return state;
  }
}

function safeFailure(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof MistralClientError) {
    return { message: error.message, retryable: error.retryable };
  }
  return { message: "Enrichment failed unexpectedly", retryable: true };
}

export class InMemoryEnrichmentStore implements EnrichmentStore {
  readonly #states = new Map<string, EnrichmentState>();

  constructor(states: EnrichmentState[] = []) {
    for (const state of states) this.#states.set(state.resourceId, structuredClone(state));
  }

  get(resourceId: string): Promise<EnrichmentState | null> {
    const state = this.#states.get(resourceId);
    return Promise.resolve(state ? structuredClone(state) : null);
  }

  save(state: EnrichmentState): Promise<void> {
    this.#states.set(state.resourceId, structuredClone(state));
    return Promise.resolve();
  }
}
