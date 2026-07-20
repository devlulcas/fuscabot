import type { DiscordMessagePayload } from "../integrations/discord_client.ts";

export type DeliveryKind = "read_later" | "share";
export type DeliveryStatus = "pending" | "sent" | "failed";

export type MessageSnapshot = {
  kind: DeliveryKind;
  title: string;
  url: string;
  summary: string | null;
  whyUseful: string | null;
  personalNote: string | null;
  selectedQuote: string | null;
  tags: string[];
  payload: DiscordMessagePayload;
};

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
