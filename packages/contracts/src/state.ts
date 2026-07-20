import type { Delivery } from "./schemas.ts";

export type LibraryState = "inbox" | "read_later" | "shared" | "archived";

type DeliveryStateInput = Pick<Delivery, "deliveryKind" | "status">;

/** Derives the primary library filter state. Failed/pending sends do not count as publication. */
export function deriveLibraryState(
  archivedAt: string | Date | null,
  deliveries: readonly DeliveryStateInput[],
): LibraryState {
  if (archivedAt !== null) return "archived";
  const sent = deliveries.filter((delivery) => delivery.status === "sent");
  if (sent.some((delivery) => delivery.deliveryKind === "share")) {
    return "shared";
  }
  if (sent.some((delivery) => delivery.deliveryKind === "read_later")) {
    return "read_later";
  }
  return "inbox";
}
