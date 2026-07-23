/// <reference path="../chrome.d.ts" />
export type PendingCapture = {
  captureId: string;
  savedAt: string;
  resourceId?: string;
  state: "extracting" | "preparing" | "ready" | "failed";
  error?: string;
  fallback?: {
    url?: string;
    title?: string;
    selectedQuote?: string;
  };
};

export type PendingCaptureInput = Omit<PendingCapture, "savedAt">;
export const PENDING_CAPTURE_RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;

/** Stores an authoritative keyed record while retaining the active record. */
export async function savePendingCapture(
  value: PendingCaptureInput,
): Promise<void> {
  const now = Date.now();
  await pruneExpiredPendingCaptures(now);
  const stored = { ...value, savedAt: new Date(now).toISOString() };
  await chrome.storage.local.set({
    [`pendingCapture:${value.captureId}`]: stored,
    pendingCapture: stored,
  });
}

export function pendingCaptureKey(captureId: string): string {
  return `pendingCapture:${captureId}`;
}

export async function getPendingCapture(
  captureId: string,
  now = Date.now(),
): Promise<PendingCapture | undefined> {
  const key = pendingCaptureKey(captureId);
  const stored = await chrome.storage.local.get([key, "pendingCapture"]);
  const keyed = stored[key];
  if (isPendingCapture(keyed) && !isExpired(keyed, now)) return keyed;
  const active = stored.pendingCapture;
  if (
    isPendingCapture(active) && active.captureId === captureId &&
    !isExpired(active, now)
  ) return active;
  await chrome.storage.local.remove(
    isPendingCapture(active) && active.captureId === captureId
      ? [key, "pendingCapture"]
      : key,
  );
  return undefined;
}

export async function pruneExpiredPendingCaptures(
  now = Date.now(),
): Promise<void> {
  const stored = await chrome.storage.local.get();
  const expired = Object.entries(stored).flatMap(([key, value]) =>
    (key === "pendingCapture" || key.startsWith("pendingCapture:")) &&
      (!isPendingCapture(value) || isExpired(value, now))
      ? [key]
      : []
  );
  if (expired.length) await chrome.storage.local.remove(expired);
}

function isPendingCapture(value: unknown): value is PendingCapture {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.captureId !== "string" ||
    typeof record.savedAt !== "string" ||
    !Number.isFinite(Date.parse(record.savedAt)) ||
    !["extracting", "preparing", "ready", "failed"].includes(
      String(record.state),
    ) ||
    (record.resourceId !== undefined &&
      typeof record.resourceId !== "string") ||
    (record.error !== undefined && typeof record.error !== "string")
  ) return false;
  if (record.fallback === undefined) return true;
  if (typeof record.fallback !== "object" || record.fallback === null) {
    return false;
  }
  return Object.values(record.fallback).every((item) =>
    item === undefined || typeof item === "string"
  );
}

function isExpired(value: PendingCapture, now: number): boolean {
  return now - Date.parse(value.savedAt) >= PENDING_CAPTURE_RETENTION_MS;
}
