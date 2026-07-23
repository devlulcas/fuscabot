import { Hono } from "@hono/hono";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";

export function createDeliveryRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>().post("/:id/retry", async (c) => {
    if (!deps.deliveries) {
      return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    }
    return c.json({ data: await deps.deliveries.retry(c.get("session").sub, c.req.param("id")) });
  });
}
