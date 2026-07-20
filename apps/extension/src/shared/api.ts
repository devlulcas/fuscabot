// @ts-nocheck Request response shapes are owned by the shared API contracts package.
import { getConfig } from "./config.ts";

export class ApiError extends Error {
  status;
  body;

  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest(
  path,
  /** @type {{method?: string, headers?: HeadersInit, body?: any, signal?: AbortSignal}} */ options =
    {},
) {
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
  const body = response.status === 204
    ? undefined
    : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(
      body?.message ?? `Request failed (${response.status})`,
      response.status,
      body,
    );
  }
  return body;
}

export const api = {
  createCapture: (payload) =>
    apiRequest("/v1/resources/captures", { method: "POST", body: payload }),
  getResource: (id, signal) =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}`, { signal }),
  updateResource: (id, patch) =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }),
  listResources: (query = "") =>
    apiRequest(`/v1/resources?${new URLSearchParams({ q: query })}`),
  publish: (id, channelId) =>
    apiRequest(`/v1/resources/${encodeURIComponent(id)}/deliveries`, {
      method: "POST",
      body: { channelId },
    }),
  readLater: (id) =>
    apiRequest(
      `/v1/resources/${encodeURIComponent(id)}/deliveries/read-later`,
      { method: "POST" },
    ),
  settings: () => apiRequest("/v1/settings"),
  syncChannels: () =>
    apiRequest("/v1/discord/channels/sync", { method: "POST" }),
};
