import type { QueryClient } from "@tanstack/react-query";
import { captureQueryKeys } from "../routes/capture/api/captures.queries.ts";
import { resourceQueryKeys } from "../routes/library/api/resources.queries.ts";

export function installRuntimeBridge(queryClient: QueryClient): () => void {
  const listener = (message: Record<string, unknown>): void => {
    if (
      message.type === "navigate-capture" &&
      typeof message.captureId === "string"
    ) {
      location.hash = `#/capture/${encodeURIComponent(message.captureId)}`;
      return;
    }
    if (
      message.type !== "capture-updated" ||
      typeof message.captureId !== "string"
    ) return;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: captureQueryKeys.pending(message.captureId),
      }),
      queryClient.invalidateQueries({
        queryKey: resourceQueryKeys.detail(
          typeof message.resourceId === "string"
            ? message.resourceId
            : message.captureId,
        ),
      }),
    ]);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
