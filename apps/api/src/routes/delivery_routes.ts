import { Hono } from "hono";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { IdParamSchema, zValidator } from "../http/validation.ts";

export function createDeliveryRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>().post(
    "/:id/retry",
    zValidator("param", IdParamSchema),
    async (c) => {
      if (!deps.deliveries) {
        return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
      }
      const { id } = c.req.valid("param");
      return c.json({ data: await deps.deliveries.retry(c.get("session").sub, id) }, 200);
    },
  );
}
