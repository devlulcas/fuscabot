import { type Context, Hono } from "@hono/hono";
import { BulkResourceActionSchema, PublicationRequestSchema } from "@fuscabot/contracts";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { CaptureSchema, ResourcePatchSchema } from "../domain/resource.ts";
import { error } from "../http/errors.ts";
import { readJsonBody } from "../http/json_body.ts";

export function createResourceRoutes(deps: AppDependencies) {
  const app = new Hono<AppEnv>();

  app.post("/captures", async (c) => {
    const input = CaptureSchema.parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes }));
    const result = await deps.resources.capture(input);
    return c.json(
      { data: result.resource, meta: { created: result.created } },
      result.created ? 201 : 200,
    );
  });
  app.get("/", async (c) => {
    const query = z.object({
      search: z.string().optional(),
      domain: z.string().trim().min(1).optional(),
      enrichmentStatus: z.enum(["preparing", "ready", "failed"]).optional(),
      tag: z.string().trim().min(1).optional(),
      state: z.enum(["inbox", "read_later", "shared"]).optional(),
      visibility: z.enum(["public", "private"]).optional(),
      sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(c.req.query());
    const rows = await deps.resources.list({ ...query, limit: query.limit + 1 });
    return c.json({
      data: rows.slice(0, query.limit),
      meta: {
        limit: query.limit,
        offset: query.offset,
        hasMore: rows.length > query.limit,
      },
    });
  });
  app.post("/bulk-actions", async (c) => {
    const input = BulkResourceActionSchema.parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    );
    return c.json({
      data: {
        action: input.action,
        affectedIds: await deps.resources.bulkAction(input.ids, input.action),
      },
    });
  });
  app.get("/:id", async (c) => {
    const row = await deps.resources.get(c.req.param("id"));
    if (!row) return error(c, 404, "NOT_FOUND", "Resource not found");
    const ownerId = c.get("session")?.sub;
    const [enrichment, deliveries] = ownerId
      ? await Promise.all([
        deps.enrichment?.get(ownerId, row.id).catch(() => null),
        deps.deliveries?.list(ownerId, row.id).catch(() => []),
      ])
      : [undefined, undefined];
    return c.json({ data: { ...row, enrichment, deliveries } });
  });
  app.patch("/:id", async (c) => {
    const row = await deps.resources.patch(
      c.req.param("id"),
      ResourcePatchSchema.parse(await readJsonBody(c, { maxBytes: deps.maxJsonBytes })),
    );
    return row ? c.json({ data: row }) : error(c, 404, "NOT_FOUND", "Resource not found");
  });
  app.delete(
    "/:id",
    async (c) =>
      (await deps.resources.delete(c.req.param("id")))
        ? c.body(null, 204)
        : error(c, 404, "NOT_FOUND", "Resource not found"),
  );
  app.post("/:id/publication", async (c) => {
    if (!deps.publications) {
      return error(c, 503, "DEPENDENCY_ERROR", "Publication is unavailable");
    }
    const input = PublicationRequestSchema.parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes, emptyValue: {} }),
    );
    return c.json({
      data: await deps.publications.publish(
        c.get("session").sub,
        c.req.param("id"),
        input.channelId,
      ),
    });
  });
  app.delete("/:id/publication", async (c) => {
    if (!deps.publications) {
      return error(c, 503, "DEPENDENCY_ERROR", "Publication is unavailable");
    }
    return c.json({
      data: await deps.publications.unpublish(c.get("session").sub, c.req.param("id")),
    });
  });
  app.post("/:id/enrichment/retry", async (c) => {
    if (!deps.enrichment) {
      return error(c, 503, "DEPENDENCY_ERROR", "Enrichment is unavailable");
    }
    return c.json({ data: await deps.enrichment.retry(c.get("session").sub, c.req.param("id")) });
  });
  app.get("/:id/deliveries", async (c) => {
    if (!deps.deliveries) {
      return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
    }
    return c.json({ data: await deps.deliveries.list(c.get("session").sub, c.req.param("id")) });
  });
  app.post("/:id/deliveries", (c) => publishDelivery(c, deps, "share"));
  app.post("/:id/deliveries/discord", (c) => publishDelivery(c, deps, "share"));
  app.post("/:id/deliveries/read-later", (c) => publishDelivery(c, deps, "read_later"));

  return app;
}

async function publishDelivery(
  c: Context<AppEnv>,
  deps: AppDependencies,
  kind: "share" | "read_later",
) {
  if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
  const body = kind === "share"
    ? z.object({ channelId: z.string().uuid() }).parse(
      await readJsonBody(c, { maxBytes: deps.maxJsonBytes }),
    )
    : {};
  return c.json({
    data: await deps.deliveries.publish(c.get("session").sub, c.req.param("id")!, {
      ...body,
      kind,
    }),
  }, 201);
}
