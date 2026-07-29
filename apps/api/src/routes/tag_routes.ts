import { Hono } from "@hono/hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { IdParamSchema, zValidator } from "../http/validation.ts";

const TagInputSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  english: z.string().trim().min(1).max(80),
  portuguese: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});
const TagSearchQuerySchema = z.object({ search: z.string().optional() });
const TagMergeSchema = z.object({ targetId: z.uuid() });

export function createTagRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>()
    .get("/", zValidator("query", TagSearchQuerySchema), async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      const { search } = c.req.valid("query");
      return c.json({ data: await deps.tags.list(c.get("session").sub, search) }, 200);
    })
    .post("/", zValidator("json", TagInputSchema), async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      const input = c.req.valid("json");
      return c.json({ data: await deps.tags.create(c.get("session").sub, input) }, 201);
    })
    .post(
      "/:id/merge",
      zValidator("param", IdParamSchema),
      zValidator("json", TagMergeSchema),
      async (c) => {
        if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
        const { id } = c.req.valid("param");
        const { targetId } = c.req.valid("json");
        return c.json({
          data: await deps.tags.merge(c.get("session").sub, id, targetId),
        }, 200);
      },
    )
    .patch(
      "/:id",
      zValidator("param", IdParamSchema),
      zValidator("json", TagInputSchema),
      async (c) => {
        if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
        const { id } = c.req.valid("param");
        const input = c.req.valid("json");
        return c.json({
          data: await deps.tags.update(c.get("session").sub, id, input),
        }, 200);
      },
    );
}
