import type {
  Capture,
  Resource,
  ResourcePatch,
} from "../../../../packages/contracts/mod.ts";

export const DEFAULT_API_BASE_URL = "https://fuscabot.devlulcas.deno.net";
export const CAPTURE_KINDS = ["page", "selection", "link"] as const;
export type CaptureKind = typeof CAPTURE_KINDS[number];
export type CapturePayload = Capture;
export type ApiResource = Resource & {
  channels?: Array<{ id: string; name: string }>;
};
export type UpdateResourcePayload = ResourcePatch;

export function isCaptureKind(value: unknown): value is CaptureKind {
  return typeof value === "string" &&
    CAPTURE_KINDS.some((kind) => kind === value);
}

export function cleanOptionalText(
  value: unknown,
  maxLength = 4_000,
): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

export function capturePath(captureId: string): string {
  return `/capture/${encodeURIComponent(captureId)}`;
}
