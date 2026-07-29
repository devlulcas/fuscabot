import type { InferResponseType } from "@hono/hono/client";
import type { apiClient } from "../../../../shared/hono-client.ts";

export type DeliveryResult = { discordUrl?: string };
export type PublicationResult = InferResponseType<
  typeof apiClient.v1.resources[":id"]["publication"]["$post"],
  200
>["data"];

export function selectDelivery(
  response:
    | InferResponseType<
      typeof apiClient.v1.resources[":id"]["deliveries"]["read-later"]["$post"],
      201
    >
    | InferResponseType<
      typeof apiClient.v1.deliveries[":id"]["retry"]["$post"],
      200
    >,
): DeliveryResult {
  return { discordUrl: response.data.externalUrl ?? undefined };
}
