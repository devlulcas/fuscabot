import type { DeliverySnapshot } from "../../../../packages/contracts/mod.ts";
export type DeliveryKind = "read_later" | "share";
export type DeliveryRecord = {
  id: string;
  resourceId: string;
  channelId: string;
  discordChannelId: string;
  guildId: string;
  kind: DeliveryKind;
  snapshot: DeliverySnapshot;
  status: "pending" | "sent" | "failed" | "unknown";
  externalMessageId: string | null;
  externalUrl: string | null;
  error: string | null;
  retryOfDeliveryId: string | null;
};
export class DeliveryTargetNotAllowedError extends Error {}
export class DeliveryConflictError extends Error {}
export class DeliveryNotRetryableError extends Error {}
export class EnrichmentPreparingError extends Error {}
