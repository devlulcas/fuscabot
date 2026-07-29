import { parseResponse } from "@hono/hono/client";
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";

export const channelQueryKeys = {
  guilds: ["discord", "guilds"] as const,
  channels: ["channels"] as const,
};

export const channelsStaleTime = 30 * 60 * 1_000;

export function guildsQueryOptions() {
  return queryOptions({
    queryKey: channelQueryKeys.guilds,
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.setup.discord.guilds.$get(undefined, { init: { signal } }),
      ),
    select: ({ data }) => data,
    staleTime: channelsStaleTime,
  });
}

export function channelsQueryOptions() {
  return queryOptions({
    queryKey: channelQueryKeys.channels,
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.channels.$get(undefined, { init: { signal } }),
      ),
    select: ({ data }) => data,
    staleTime: channelsStaleTime,
  });
}
