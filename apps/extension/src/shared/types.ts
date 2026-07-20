export const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const CAPTURE_KINDS = ["page", "selection", "link"];

export function isCaptureKind(value) {
  return CAPTURE_KINDS.includes(value);
}

export function cleanOptionalText(value, maxLength = 4_000) {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

export function capturePath(captureId) {
  return `/capture/${encodeURIComponent(captureId)}`;
}
