export function canPublish(
  enrichmentStatus: "preparing" | "ready" | "failed",
): boolean {
  return enrichmentStatus !== "preparing";
}
