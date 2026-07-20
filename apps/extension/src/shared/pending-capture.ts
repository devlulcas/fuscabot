/// <reference path="../chrome.d.ts" />
export type PendingCapture = {
  captureId: string;
  resourceId?: string;
  state: "extracting" | "preparing" | "ready" | "failed";
  error?: string;
  fallback?: {
    url?: string;
    title?: string;
    selectedQuote?: string;
  };
};

/** Stores an authoritative keyed record while retaining the legacy active record. */
export async function savePendingCapture(value: PendingCapture): Promise<void> {
  await chrome.storage.local.set({
    [`pendingCapture:${value.captureId}`]: value,
    pendingCapture: value,
  });
}

export function pendingCaptureKey(captureId: string): string {
  return `pendingCapture:${captureId}`;
}

export async function getPendingCapture(
  captureId: string,
): Promise<PendingCapture | undefined> {
  const key = pendingCaptureKey(captureId);
  const stored = await chrome.storage.local.get([key, "pendingCapture"]);
  const keyed = stored[key];
  if (isPendingCapture(keyed)) return keyed;
  return isPendingCapture(stored.pendingCapture) &&
      stored.pendingCapture.captureId === captureId
    ? stored.pendingCapture
    : undefined;
}

function isPendingCapture(value: unknown): value is PendingCapture {
  return typeof value === "object" && value !== null &&
    typeof (value as PendingCapture).captureId === "string";
}
