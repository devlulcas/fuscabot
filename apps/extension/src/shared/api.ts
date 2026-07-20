import {
  ApiErrorSchema,
  DeliverySchema,
  ResourceSchema,
} from "../../../../packages/contracts/mod.ts";
import type { ApiError as ApiErrorBody } from "../../../../packages/contracts/mod.ts";
import { getConfig } from "./config.ts";
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
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
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

type DeliveryResult = { discordUrl?: string };
export type DiscordSession = {
  discordUserId: string;
  guildIds: string[];
  expiresAt: string;
};
export type DiscordGuild = { id: string; name: string; icon: string | null };
export type DiscordChannel = {
  id: string;
  name: string;
  type: 0;
  parent_id: string | null;
  topic: string | null;
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
  async listResources(query = ""): Promise<ApiResource[]> {
    return parseResourceListEnvelope(
      await apiRequest<unknown>(
        `/v1/resources?${new URLSearchParams({ search: query })}`,
      ),
    );
  },
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
  session: async (): Promise<DiscordSession> =>
    (await apiRequest<DataEnvelope<DiscordSession>>("/v1/auth/session")).data,
  guilds: async (): Promise<DiscordGuild[]> =>
    (await apiRequest<DataEnvelope<DiscordGuild[]>>("/v1/setup/discord/guilds"))
      .data,
  syncChannels: async (guildId: string): Promise<DiscordChannel[]> =>
    (await apiRequest<DataEnvelope<DiscordChannel[]>>(
      "/v1/discord/channels/sync",
      {
        method: "POST",
        body: { guildId },
      },
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
  return channels === undefined ? parsed.data : { ...parsed.data, channels };
}

export function parseResourceListEnvelope(value: unknown): ApiResource[] {
  const data = envelopeData(value);
  if (!Array.isArray(data)) throw new ContractResponseError();
  return data.map((resource) => parseResourceEnvelope({ data: resource }));
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
    (data.discordUrl === undefined || typeof data.discordUrl === "string")
  ) {
    return { discordUrl: data.discordUrl };
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
