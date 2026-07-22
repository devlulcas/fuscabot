import {
  ApiErrorSchema,
  type BulkResourceAction,
  BulkResourceActionResultSchema,
  DeliverySchema,
  ResourceSchema,
} from "../../../../packages/contracts/mod.ts";
import type { ApiError as ApiErrorBody } from "../../../../packages/contracts/mod.ts";
import { getConfig, saveConfig } from "./config.ts";
import type {
  ApiResource,
  CapturePayload,
  UpdateResourcePayload,
} from "./types.ts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: ApiErrorBody | unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ContractResponseError extends Error {
  constructor(message = "The API returned an invalid response") {
    super(message);
    this.name = "ContractResponseError";
  }
}

type RequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
};

let refreshInFlight: Promise<{ accessToken: string } | null> | undefined;
let sessionInvalidated: (() => Promise<void> | void) | undefined;

export function onSessionInvalidated(
  handler: () => Promise<void> | void,
): void {
  sessionInvalidated = handler;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const config = await getConfig();
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (config.accessToken) {
    headers.set("authorization", `Bearer ${config.accessToken}`);
  }
  let response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (response.status === 401 && config.refreshToken && config.sessionId) {
    const refreshed = await refreshSession(config);
    if (refreshed) {
      headers.set("authorization", `Bearer ${refreshed.accessToken}`);
      response = await fetch(`${config.apiBaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
        signal: options.signal,
      });
    }
  }
  const body: unknown = response.status === 204
    ? undefined
    : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(
      errorMessage(body) ?? `Request failed (${response.status})`,
      response.status,
      body,
    );
  }
  return body as T;
}

async function refreshSession(
  config: Awaited<ReturnType<typeof getConfig>>,
): Promise<{ accessToken: string } | null> {
  if (refreshInFlight) return await refreshInFlight;
  const operation = (async (): Promise<{ accessToken: string } | null> => {
    try {
      const refresh = await fetch(`${config.apiBaseUrl}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sessionId: config.sessionId,
          refreshToken: config.refreshToken,
        }),
      });
      const refreshed = await refresh.json().catch(() => undefined);
      const data = isRecord(refreshed) && isRecord(refreshed.data)
        ? refreshed.data
        : undefined;
      if (
        !refresh.ok || !data || typeof data.accessToken !== "string" ||
        typeof data.refreshToken !== "string"
      ) throw new Error("Session refresh failed");
      await saveConfig({
        ...config,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return { accessToken: data.accessToken };
    } catch {
      await saveConfig({
        ...config,
        accessToken: undefined,
        refreshToken: undefined,
        sessionId: undefined,
      });
      await sessionInvalidated?.();
      return null;
    }
  })();
  refreshInFlight = operation;
  try {
    return await operation;
  } finally {
    if (refreshInFlight === operation) refreshInFlight = undefined;
  }
}

type DeliveryResult = { discordUrl?: string };
type DataEnvelope<T> = { data: T };
export type ResourcePage = {
  items: ApiResource[];
  pageInfo: { limit: number; offset: number; hasMore: boolean };
};
export type DiscordSession = {
  discordUserId: string;
  guildIds: string[];
  expiresAt: string;
};
export type DiscordGuild = { id: string; name: string; icon: string | null };
export type DiscordChannel = {
  id: string;
  name: string;
  discordChannelId: string;
  parentName: string | null;
  discordTopic: string | null;
  routingDescription: string | null;
  isActiveForRouting: boolean;
  isReadLater: boolean;
  availability: "available" | "unavailable";
  lastSyncedAt: string | null;
};
export type CanonicalTag = {
  id: string;
  slug: string;
  labels: Array<{ language: "en" | "pt-BR"; name: string }>;
  aliases: string[];
};

export const api = {
  async createCapture(payload: CapturePayload): Promise<ApiResource> {
    return parseResourceEnvelope(
      await apiRequest<unknown>(
        "/v1/resources/captures",
        {
          method: "POST",
          body: payload,
        },
      ),
    );
  },
  async getResource(id: string, signal?: AbortSignal): Promise<ApiResource> {
    return parseResourceEnvelope(
      await apiRequest<unknown>(
        `/v1/resources/${encodeURIComponent(id)}`,
        { signal },
      ),
    );
  },
  async updateResource(
    id: string,
    patch: UpdateResourcePayload,
  ): Promise<ApiResource> {
    return parseResourceEnvelope(
      await apiRequest<unknown>(
        `/v1/resources/${encodeURIComponent(id)}`,
        { method: "PATCH", body: patch },
      ),
    );
  },
  async listResources(query = "", options: {
    archived?: boolean;
    state?: "inbox" | "read_later" | "shared" | "archived";
    domain?: string;
    enrichmentStatus?: "preparing" | "ready" | "failed";
    sort?: "newest" | "oldest" | "updated";
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
  } = {}): Promise<ResourcePage> {
    const params = new URLSearchParams({ search: query });
    for (const [key, value] of Object.entries(options)) {
      if (key === "signal") continue;
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return parseResourcePageEnvelope(
      await apiRequest<unknown>(`/v1/resources?${params}`, {
        signal: options.signal,
      }),
    );
  },
  deleteResource: (id: string): Promise<void> =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}`, { method: "DELETE" }),
  bulkResources: async (
    ids: string[],
    action: BulkResourceAction["action"],
  ): Promise<
    { action: BulkResourceAction["action"]; affectedIds: string[] }
  > =>
    parseBulkResourceResult(
      await apiRequest<unknown>("/v1/resources/bulk-actions", {
        method: "POST",
        body: { ids, action },
      }),
    ),
  publish: async (id: string, channelId: string): Promise<DeliveryResult> =>
    parseDeliveryResult(
      await apiRequest(`/v1/resources/${encodeURIComponent(id)}/deliveries`, {
        method: "POST",
        body: { channelId },
      }),
    ),
  readLater: async (id: string): Promise<DeliveryResult> =>
    parseDeliveryResult(
      await apiRequest(
        `/v1/resources/${encodeURIComponent(id)}/deliveries/read-later`,
        {
          method: "POST",
        },
      ),
    ),
  retryEnrichment: (id: string): Promise<unknown> =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}/enrichment/retry`, {
      method: "POST",
    }),
  session: async (signal?: AbortSignal): Promise<DiscordSession> =>
    (await apiRequest<DataEnvelope<DiscordSession>>("/v1/auth/session", {
      signal,
    })).data,
  guilds: async (signal?: AbortSignal): Promise<DiscordGuild[]> =>
    (await apiRequest<DataEnvelope<DiscordGuild[]>>(
      "/v1/setup/discord/guilds",
      { signal },
    ))
      .data,
  syncChannels: async (guildId: string): Promise<DiscordChannel[]> =>
    (await apiRequest<DataEnvelope<DiscordChannel[]>>(
      "/v1/discord/channels/sync",
      {
        method: "POST",
        body: { guildId },
      },
    )).data,
  channels: async (signal?: AbortSignal): Promise<DiscordChannel[]> =>
    (await apiRequest<DataEnvelope<DiscordChannel[]>>("/v1/channels", {
      signal,
    })).data,
  updateChannel: async (
    id: string,
    patch: {
      routingDescription?: string | null;
      isActiveForRouting?: boolean;
      isReadLater?: boolean;
    },
  ): Promise<DiscordChannel> =>
    (await apiRequest<DataEnvelope<DiscordChannel>>(
      `/v1/channels/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: patch,
      },
    )).data,
  selectGuild: async (guildId: string): Promise<DiscordChannel[]> =>
    (await apiRequest<DataEnvelope<DiscordChannel[]>>(
      "/v1/setup/discord/guild",
      {
        method: "POST",
        body: { guildId },
      },
    )).data,
  tags: async (search = "", signal?: AbortSignal): Promise<CanonicalTag[]> =>
    (await apiRequest<DataEnvelope<CanonicalTag[]>>(
      `/v1/tags?${new URLSearchParams({ search })}`,
      { signal },
    )).data,
  createTag: async (input: {
    slug: string;
    english: string;
    portuguese: string;
    aliases: string[];
  }): Promise<CanonicalTag> =>
    (await apiRequest<DataEnvelope<CanonicalTag>>("/v1/tags", {
      method: "POST",
      body: input,
    })).data,
  updateTag: async (
    id: string,
    input: {
      slug: string;
      english: string;
      portuguese: string;
      aliases: string[];
    },
  ): Promise<CanonicalTag> =>
    (await apiRequest<DataEnvelope<CanonicalTag>>(
      `/v1/tags/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: input,
      },
    )).data,
  mergeTag: async (sourceId: string, targetId: string): Promise<CanonicalTag> =>
    (await apiRequest<DataEnvelope<CanonicalTag>>(
      `/v1/tags/${encodeURIComponent(sourceId)}/merge`,
      { method: "POST", body: { targetId } },
    )).data,
};

function errorMessage(value: unknown): string | undefined {
  const parsed = ApiErrorSchema.safeParse(value);
  return parsed.success ? parsed.data.error.message : undefined;
}

export function parseResourceEnvelope(value: unknown): ApiResource {
  const data = envelopeData(value);
  const parsed = ResourceSchema.safeParse(data);
  if (!parsed.success) throw new ContractResponseError();
  const channels = readChannels(data);
  const details = isRecord(data)
    ? {
      enrichment: data.enrichment as ApiResource["enrichment"],
      deliveries: data.deliveries as ApiResource["deliveries"],
    }
    : {};
  return channels === undefined
    ? { ...parsed.data, ...details }
    : { ...parsed.data, channels, ...details };
}

export function parseResourceListEnvelope(value: unknown): ApiResource[] {
  const data = envelopeData(value);
  if (!Array.isArray(data)) throw new ContractResponseError();
  return data.map((resource) => parseResourceEnvelope({ data: resource }));
}

export function parseResourcePageEnvelope(value: unknown): ResourcePage {
  const items = parseResourceListEnvelope(value);
  if (!isRecord(value) || !isRecord(value.meta)) {
    throw new ContractResponseError();
  }
  const { limit, offset, hasMore } = value.meta;
  if (
    typeof limit !== "number" || typeof offset !== "number" ||
    typeof hasMore !== "boolean"
  ) throw new ContractResponseError();
  return { items, pageInfo: { limit, offset, hasMore } };
}

export function parseBulkResourceResult(value: unknown): {
  action: BulkResourceAction["action"];
  affectedIds: string[];
} {
  const parsed = BulkResourceActionResultSchema.safeParse(envelopeData(value));
  if (!parsed.success) throw new ContractResponseError();
  return parsed.data;
}

export function parseDeliveryResult(value: unknown): DeliveryResult {
  const data = isRecord(value) && "data" in value ? value.data : value;
  const parsed = DeliverySchema.safeParse(data);
  if (parsed.success) {
    return { discordUrl: parsed.data.externalUrl ?? undefined };
  }

  // Temporary compatibility for the original extension/API mock boundary.
  if (
    isRecord(data) &&
    (data.discordUrl === undefined || typeof data.discordUrl === "string") &&
    (data.externalUrl === undefined || data.externalUrl === null ||
      typeof data.externalUrl === "string")
  ) {
    return {
      discordUrl: typeof data.externalUrl === "string"
        ? data.externalUrl
        : data.discordUrl as string | undefined,
    };
  }
  throw new ContractResponseError();
}

function envelopeData(value: unknown): unknown {
  if (!isRecord(value) || !("data" in value)) throw new ContractResponseError();
  return value.data;
}

function readChannels(value: unknown): ApiResource["channels"] {
  if (!isRecord(value) || !("channels" in value)) return undefined;
  if (!Array.isArray(value.channels)) throw new ContractResponseError();
  return value.channels.map((channel) => {
    if (
      !isRecord(channel) || typeof channel.id !== "string" ||
      typeof channel.name !== "string"
    ) throw new ContractResponseError();
    return { id: channel.id, name: channel.name };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
