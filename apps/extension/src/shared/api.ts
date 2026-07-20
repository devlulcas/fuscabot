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

type DataEnvelope<T> = { data: T };
type DeliveryResult = { discordUrl?: string };

export const api = {
  async createCapture(payload: CapturePayload): Promise<ApiResource> {
    return (await apiRequest<DataEnvelope<ApiResource>>(
      "/v1/resources/captures",
      {
        method: "POST",
        body: payload,
      },
    )).data;
  },
  async getResource(id: string, signal?: AbortSignal): Promise<ApiResource> {
    return (await apiRequest<DataEnvelope<ApiResource>>(
      `/v1/resources/${encodeURIComponent(id)}`,
      { signal },
    )).data;
  },
  async updateResource(
    id: string,
    patch: UpdateResourcePayload,
  ): Promise<ApiResource> {
    return (await apiRequest<DataEnvelope<ApiResource>>(
      `/v1/resources/${encodeURIComponent(id)}`,
      { method: "PATCH", body: patch },
    )).data;
  },
  async listResources(query = ""): Promise<ApiResource[]> {
    return (await apiRequest<DataEnvelope<ApiResource[]>>(
      `/v1/resources?${new URLSearchParams({ search: query })}`,
    )).data;
  },
  publish: (id: string, channelId: string): Promise<DeliveryResult> =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}/deliveries`, {
      method: "POST",
      body: { channelId },
    }),
  readLater: (id: string): Promise<DeliveryResult> =>
    apiRequest(
      `/v1/resources/${encodeURIComponent(id)}/deliveries/read-later`,
      {
        method: "POST",
      },
    ),
  settings: (): Promise<unknown> => apiRequest("/v1/settings"),
  syncChannels: (): Promise<unknown> =>
    apiRequest("/v1/discord/channels/sync", { method: "POST" }),
};

function errorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return undefined;
  }
  const error = value.error;
  return typeof error === "object" && error !== null && "message" in error &&
      typeof error.message === "string"
    ? error.message
    : undefined;
}
