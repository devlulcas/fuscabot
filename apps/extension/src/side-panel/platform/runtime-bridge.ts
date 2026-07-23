import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../data/query-keys.ts";

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
        queryKey: queryKeys.pendingCapture(message.captureId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.resource(
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
