import { Hono } from "@hono/hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { readJsonBody } from "../http/json_body.ts";

const TagInputSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  english: z.string().trim().min(1).max(80),
  portuguese: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

export function createTagRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      return c.json({ data: await deps.tags.list(c.get("session").sub, c.req.query("search")) });
    })
    .post("/", async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      const input = TagInputSchema.parse(
        await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
      );
      return c.json({ data: await deps.tags.create(c.get("session").sub, input) }, 201);
    })
    .post("/:id/merge", async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      const { targetId } = z.object({ targetId: z.uuid() }).parse(
        await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
      );
      return c.json({
        data: await deps.tags.merge(c.get("session").sub, c.req.param("id"), targetId),
      });
    })
    .patch("/:id", async (c) => {
      if (!deps.tags) return error(c, 503, "DEPENDENCY_ERROR", "Tag storage is unavailable");
      const input = TagInputSchema.parse(
        await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
      );
      return c.json({
        data: await deps.tags.update(c.get("session").sub, c.req.param("id"), input),
      });
    });
}
