import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api.ts";
import { getConfig } from "../../shared/config.ts";
import { getPendingCapture } from "../../shared/pending-capture.ts";
import { queryKeys } from "./query-keys.ts";

export const FIVE_MINUTES = 5 * 60 * 1_000;
export const THIRTY_MINUTES = 30 * 60 * 1_000;
export const MAX_CAPTURE_POLL_UPDATES = 30;

export const configQuery = () =>
  queryOptions({
    queryKey: queryKeys.config,
    queryFn: getConfig,
    staleTime: Infinity,
    meta: { persist: false },
  });
export const sessionQuery = () =>
  queryOptions({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => api.session(signal),
    staleTime: THIRTY_MINUTES,
  });
export const guildsQuery = () =>
  queryOptions({
    queryKey: queryKeys.guilds,
    queryFn: ({ signal }) => api.guilds(signal),
    staleTime: THIRTY_MINUTES,
  });
export const channelsQuery = () =>
  queryOptions({
    queryKey: queryKeys.channels,
    queryFn: ({ signal }) => api.channels(signal),
    staleTime: THIRTY_MINUTES,
  });
export const tagsQuery = (search = "") =>
  queryOptions({
    queryKey: queryKeys.tagList(search),
    queryFn: ({ signal }) => api.tags(search, signal),
    staleTime: THIRTY_MINUTES,
  });
export const capturePollInterval = (
  state: string | undefined,
  consecutiveFailures = 0,
  successfulUpdates = 0,
) =>
  consecutiveFailures < 2 &&
    successfulUpdates < MAX_CAPTURE_POLL_UPDATES &&
    (state === "extracting" || state === "preparing")
    ? 2_000
    : false;
export const pendingCaptureQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.pendingCapture(id),
    queryFn: () => getPendingCapture(id),
    staleTime: 0,
    refetchInterval: (query) =>
      capturePollInterval(
        query.state.data?.state,
        query.state.fetchFailureCount,
        query.state.dataUpdateCount,
      ),
    refetchIntervalInBackground: false,
  });
export const resourceQuery = (id: string, enabled = true) =>
  queryOptions({
    queryKey: queryKeys.resource(id),
    queryFn: ({ signal }) => api.getResource(id, signal),
    enabled,
    staleTime: FIVE_MINUTES,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
