import { Hono } from "@hono/hono";
import { z } from "zod";
import { CaptureSchema, ResourcePatchSchema } from "./domain/resource.ts";
import { error, handleError } from "./http/errors.ts";
import { InMemoryResourceRepository } from "./repositories/resource_repository.ts";
import { ResourceService } from "./services/resource_service.ts";

export type AppDependencies = { resources: ResourceService };

export function createApp(
  deps: AppDependencies = { resources: new ResourceService(new InMemoryResourceRepository()) },
) {
  const app = new Hono();
  app.onError((cause, c) => handleError(c, cause));
  app.notFound((c) => error(c, 404, "NOT_FOUND", "Route not found"));
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.post("/v1/resources/captures", async (c) => {
    const input = CaptureSchema.parse(await c.req.json());
    const result = await deps.resources.capture(input);
    return c.json(
      { data: result.resource, meta: { created: result.created } },
      result.created ? 201 : 200,
    );
  });
  app.get("/v1/resources", async (c) => {
    const query = z.object({
      search: z.string().optional(),
      archived: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(c.req.query());
    return c.json({
      data: await deps.resources.list(query),
      meta: { limit: query.limit, offset: query.offset },
    });
  });
  app.get("/v1/resources/:id", async (c) => {
    const row = await deps.resources.get(c.req.param("id"));
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Resource not found");
  });
  app.patch("/v1/resources/:id", async (c) => {
    const row = await deps.resources.patch(
      c.req.param("id"),
      ResourcePatchSchema.parse(await c.req.json()),
    );
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Resource not found");
  });
  app.delete(
    "/v1/resources/:id",
    async (c) =>
      (await deps.resources.delete(c.req.param("id")))
        ? c.body(null, 204)
        : error(c, 404, "NOT_FOUND", "Resource not found"),
  );
  return app;
}

export const app = createApp();
