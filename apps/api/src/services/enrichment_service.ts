import type { EnrichmentDraft } from "../../../../packages/contracts/mod.ts";
import {
  ENRICHMENT_PROMPT_VERSION,
  type EnrichmentClaim,
  type EnrichmentInput,
  type EnrichmentState,
} from "../domain/enrichment.ts";
import { MistralClientError } from "../integrations/mistral_client.ts";

export interface EnrichmentClient {
  enrich(input: EnrichmentState["input"]): Promise<EnrichmentDraft>;
}

export interface EnrichmentStore {
  get(resourceId: string): Promise<EnrichmentState | null>;
  claim(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentClaim>;
  completeReady(resourceId: string, draft: EnrichmentDraft): Promise<EnrichmentState>;
  completeFailed(
    resourceId: string,
    error: string,
    retryable: boolean,
  ): Promise<EnrichmentState>;
}

export class EnrichmentService {
  readonly #running = new Map<string, Promise<EnrichmentState>>();

  constructor(private readonly store: EnrichmentStore, private readonly client: EnrichmentClient) {}

  async prepare(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentState> {
    const state = await this.store.get(resourceId);
    if (state?.status === "ready") return state;
    return this.#runOnce(resourceId, input);
  }

  async retry(resourceId: string): Promise<EnrichmentState> {
    const state = await this.store.get(resourceId);
    if (!state) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    if (state.status === "ready") return state;
    return this.#runOnce(resourceId);
  }

  #runOnce(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentState> {
    const active = this.#running.get(resourceId);
    if (active) return active;
    const operation = this.#execute(resourceId, input).finally(() =>
      this.#running.delete(resourceId)
    );
    this.#running.set(resourceId, operation);
    return operation;
  }

  async #execute(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentState> {
    // claim() is the durability boundary: no external request begins until the run exists.
    const claim = await this.store.claim(resourceId, input);
    if (!claim.claimed) return claim.state;
    try {
      const draft = await this.client.enrich(claim.state.input);
      return await this.store.completeReady(resourceId, draft);
    } catch (error) {
      const failure = safeFailure(error);
      return await this.store.completeFailed(resourceId, failure.message, failure.retryable);
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
  readonly #active = new Set<string>();

  constructor(states: EnrichmentState[] = []) {
    for (const state of states) this.#states.set(state.resourceId, structuredClone(state));
  }

  get(resourceId: string): Promise<EnrichmentState | null> {
    const state = this.#states.get(resourceId);
    return Promise.resolve(state ? structuredClone(state) : null);
  }

  claim(resourceId: string, input?: EnrichmentInput): Promise<EnrichmentClaim> {
    const previous = this.#states.get(resourceId);
    if (!previous && !input) throw new Error(`Unknown enrichment resource: ${resourceId}`);
    if (previous?.status === "ready" || this.#active.has(resourceId)) {
      return Promise.resolve({ state: structuredClone(previous!), claimed: false });
    }
    const state: EnrichmentState = {
      ...(previous ?? {
        resourceId,
        input: input!,
        attempt: 0,
        draft: null,
      }),
      input: input ?? previous!.input,
      status: "preparing",
      attempt: (previous?.attempt ?? 0) + 1,
      error: null,
      retryable: false,
      promptVersion: ENRICHMENT_PROMPT_VERSION,
    };
    this.#active.add(resourceId);
    this.#states.set(resourceId, structuredClone(state));
    return Promise.resolve({ state, claimed: true });
  }

  completeReady(resourceId: string, draft: EnrichmentDraft): Promise<EnrichmentState> {
    return Promise.resolve(
      this.#complete(resourceId, { status: "ready", draft, error: null, retryable: false }),
    );
  }

  completeFailed(resourceId: string, error: string, retryable: boolean): Promise<EnrichmentState> {
    return Promise.resolve(this.#complete(resourceId, { status: "failed", error, retryable }));
  }

  #complete(resourceId: string, patch: Partial<EnrichmentState>): EnrichmentState {
    const current = this.#states.get(resourceId);
    if (!current || !this.#active.delete(resourceId)) throw new Error("Enrichment claim was lost");
    const state = { ...current, ...patch };
    this.#states.set(resourceId, structuredClone(state));
    return state;
  }
}
