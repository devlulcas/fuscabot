import type { DeliverySnapshot } from "../../../../packages/contracts/mod.ts";
import type { deliveries, discordConnections } from "../db/schema.ts";

type DeliveryRow = typeof deliveries.$inferSelect;
type DiscordConnectionRow = typeof discordConnections.$inferSelect;

export type DeliveryKind = DeliveryRow["deliveryKind"];
export type DeliveryRecord =
  & Pick<
    DeliveryRow,
    | "id"
    | "resourceId"
    | "externalMessageId"
    | "externalUrl"
    | "error"
    | "retryOfDeliveryId"
  >
  & {
    channelId: NonNullable<DeliveryRow["channelId"]>;
    discordChannelId: string;
    guildId: DiscordConnectionRow["discordGuildId"];
    kind: DeliveryKind;
    snapshot: DeliverySnapshot;
    status: DeliveryRow["status"];
  };
export class DeliveryTargetNotAllowedError extends Error {}
export class DeliveryConflictError extends Error {}
export class DeliveryNotRetryableError extends Error {}
export class EnrichmentPreparingError extends Error {}
