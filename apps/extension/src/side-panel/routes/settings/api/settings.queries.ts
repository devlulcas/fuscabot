import { parseResponse } from "@hono/hono/client";
import { queryOptions } from "@tanstack/react-query";
import { getConfig } from "../../../../shared/config.ts";
import { apiClient } from "../../../../shared/hono-client.ts";

export const settingsQueryKeys = {
  config: ["config"] as const,
  session: ["auth", "session"] as const,
};

export const settingsSessionStaleTime = 30 * 60 * 1_000;

export function configQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.config,
    queryFn: getConfig,
    staleTime: Infinity,
    meta: { persist: false },
  });
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.session,
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.auth.session.$get(undefined, { init: { signal } }),
      ),
    select: ({ data }) => data,
    staleTime: settingsSessionStaleTime,
  });
}
