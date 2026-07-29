import { queryOptions } from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";

export const channelQueryKeys = {
  guilds: ["discord", "guilds"] as const,
  channels: ["channels"] as const,
};

export const channelsStaleTime = 30 * 60 * 1_000;

export function guildsQueryOptions() {
  return queryOptions({
    queryKey: channelQueryKeys.guilds,
    queryFn: ({ signal }) => api.guilds(signal),
    staleTime: channelsStaleTime,
  });
}

export function channelsQueryOptions() {
  return queryOptions({
    queryKey: channelQueryKeys.channels,
    queryFn: ({ signal }) => api.channels(signal),
    staleTime: channelsStaleTime,
  });
}
