import type { InferResponseType } from "@hono/hono/client";
import type { apiClient } from "../../../../shared/hono-client.ts";

export type CanonicalTag = InferResponseType<
  typeof apiClient.v1.tags.$get,
  200
>["data"][number];
