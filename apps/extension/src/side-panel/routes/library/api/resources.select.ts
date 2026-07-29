import type { InferResponseType } from "@hono/hono/client";
import type { Resource } from "@fuscabot/contracts";
import type { apiClient } from "../../../../shared/hono-client.ts";

type ResourceDetails = Pick<
  InferResponseType<typeof apiClient.v1.resources[":id"]["$get"], 200>["data"],
  "enrichment" | "deliveries"
>;

export type ApiResource = Resource & Partial<ResourceDetails>;
export type ResourcePage = {
  items: ApiResource[];
  pageInfo: InferResponseType<typeof apiClient.v1.resources.$get, 200>["meta"];
};
export function selectResourcePage(
  response: InferResponseType<typeof apiClient.v1.resources.$get, 200>,
): ResourcePage {
  return {
    items: response.data,
    pageInfo: response.meta,
  };
}
