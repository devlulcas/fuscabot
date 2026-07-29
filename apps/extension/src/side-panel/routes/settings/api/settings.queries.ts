import { queryOptions } from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";
import { getConfig } from "../../../../shared/config.ts";

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
    queryFn: ({ signal }) => api.session(signal),
    staleTime: settingsSessionStaleTime,
  });
}
