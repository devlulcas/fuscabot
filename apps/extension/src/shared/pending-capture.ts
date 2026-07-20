/// <reference path="../chrome.d.ts" />
export type PendingCapture = {
  captureId: string;
  resourceId?: string;
  state: "saving" | "saved" | "failed";
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
