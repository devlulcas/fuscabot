import type { InferRequestType } from "@hono/hono/client";
import { apiClient } from "../../../../shared/hono-client.ts";

export type ChannelPatch = NonNullable<
  InferRequestType<typeof apiClient.v1.channels[":id"]["$patch"]>["json"]
>;
