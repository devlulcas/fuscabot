import { queryOptions } from "@tanstack/react-query";
import { getPendingCapture } from "../../../../shared/pending-capture.ts";

export const captureQueryKeys = {
  pending: (id: string) => ["pending-capture", id] as const,
};

export const MAX_CAPTURE_POLL_UPDATES = 30;

export function capturePollInterval(
  state: string | undefined,
  consecutiveFailures = 0,
  successfulUpdates = 0,
) {
  return consecutiveFailures < 2 &&
      successfulUpdates < MAX_CAPTURE_POLL_UPDATES &&
      (state === "extracting" || state === "preparing")
    ? 2_000
    : false;
}

export function pendingCaptureQueryOptions(id: string) {
  return queryOptions({
    queryKey: captureQueryKeys.pending(id),
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
}
