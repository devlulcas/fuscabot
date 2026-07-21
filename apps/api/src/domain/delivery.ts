import type { DeliverySnapshotV2 } from "@fuscabot/contracts";

export type DeliveryKind = "read_later" | "share";
export type DeliveryStatus = "pending" | "sent" | "failed" | "unknown";

export type MessageSnapshot = DeliverySnapshotV2;

export type Delivery = {
  id: string;
  resourceId: string;
  channelId: string;
  discordChannelId: string;
  kind: DeliveryKind;
  snapshot: MessageSnapshot;
  status: DeliveryStatus;
  externalMessageId: string | null;
  externalUrl: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};
