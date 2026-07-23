export function canPublish(
  enrichmentStatus: "preparing" | "ready" | "failed",
): boolean {
  return enrichmentStatus !== "preparing";
}

export function resolveDestination({
  enrichmentStatus,
  selectionStatus,
  selectedChannelId,
  suggestedChannelId,
  availableChannelIds,
}: {
  enrichmentStatus: string;
  selectionStatus: string;
  selectedChannelId: string;
  suggestedChannelId?: string | null;
  availableChannelIds: ReadonlySet<string>;
}): string {
  if (selectionStatus === enrichmentStatus) {
    return availableChannelIds.has(selectedChannelId) ? selectedChannelId : "";
  }
  return suggestedChannelId && availableChannelIds.has(suggestedChannelId)
    ? suggestedChannelId
    : "";
}

export async function saveBeforeDelivery<Patch, Result>(
  patch: Patch,
  save: (value: Patch) => Promise<unknown>,
  deliver: () => Promise<Result>,
): Promise<Result> {
  await save(patch);
  return await deliver();
}
