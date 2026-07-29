import { type Context, Hono } from "@hono/hono";
import { BulkResourceActionSchema, PublicationRequestSchema } from "@fuscabot/contracts";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { CaptureSchema, ResourcePatchSchema } from "../domain/resource.ts";
import { error } from "../http/errors.ts";
import { IdParamSchema, zValidator } from "../http/validation.ts";

const ResourceQuerySchema = z.object({
  search: z.string().optional(),
  domain: z.string().trim().min(1).optional(),
  enrichmentStatus: z.enum(["preparing", "ready", "failed"]).optional(),
  tag: z.string().trim().min(1).optional(),
  state: z.enum(["inbox", "read_later", "shared"]).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createResourceRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>()
    .post("/captures", zValidator("json", CaptureSchema), async (c) => {
      const input = c.req.valid("json");
      const result = await deps.resources.capture(input);
      return c.json(
        { data: result.resource, meta: { created: result.created } },
        result.created ? 201 : 200,
      );
    })
    .get("/", zValidator("query", ResourceQuerySchema), async (c) => {
      const query = c.req.valid("query");
      const rows = await deps.resources.list({ ...query, limit: query.limit + 1 });
      return c.json({
        data: rows.slice(0, query.limit),
        meta: {
          limit: query.limit,
          offset: query.offset,
          hasMore: rows.length > query.limit,
        },
      }, 200);
    })
    .post("/bulk-actions", zValidator("json", BulkResourceActionSchema), async (c) => {
      const input = c.req.valid("json");
      return c.json({
        data: {
          action: input.action,
          affectedIds: await deps.resources.bulkAction(input.ids, input.action),
        },
      }, 200);
    })
    .get("/:id", zValidator("param", IdParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      const row = await deps.resources.get(id);
      if (!row) return error(c, 404, "NOT_FOUND", "Resource not found");
      const ownerId = c.get("session")?.sub;
      const [enrichment, deliveries] = ownerId
        ? await Promise.all([
          deps.enrichment?.get(ownerId, row.id).catch(() => null),
          deps.deliveries?.list(ownerId, row.id).catch(() => []),
        ])
        : [undefined, undefined];
      return c.json({ data: { ...row, enrichment, deliveries } }, 200);
    })
    .patch(
      "/:id",
      zValidator("param", IdParamSchema),
      zValidator("json", ResourcePatchSchema),
      async (c) => {
        const { id } = c.req.valid("param");
        const row = await deps.resources.patch(id, c.req.valid("json"));
        return row ? c.json({ data: row }, 200) : error(c, 404, "NOT_FOUND", "Resource not found");
      },
    )
    .delete("/:id", zValidator("param", IdParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      return (await deps.resources.delete(id))
        ? c.body(null, 204)
        : error(c, 404, "NOT_FOUND", "Resource not found");
    })
    .post(
      "/:id/publication",
      zValidator("param", IdParamSchema),
      zValidator("json", PublicationRequestSchema),
      async (c) => {
        if (!deps.publications) {
          return error(c, 503, "DEPENDENCY_ERROR", "Publication is unavailable");
        }
        const { id } = c.req.valid("param");
        const input = c.req.valid("json");
        return c.json({
          data: await deps.publications.publish(c.get("session").sub, id, input.channelId),
        }, 200);
      },
    )
    .delete("/:id/publication", zValidator("param", IdParamSchema), async (c) => {
      if (!deps.publications) {
        return error(c, 503, "DEPENDENCY_ERROR", "Publication is unavailable");
      }
      const { id } = c.req.valid("param");
      return c.json({
        data: await deps.publications.unpublish(c.get("session").sub, id),
      }, 200);
    })
    .post("/:id/enrichment/retry", zValidator("param", IdParamSchema), async (c) => {
      if (!deps.enrichment) {
        return error(c, 503, "DEPENDENCY_ERROR", "Enrichment is unavailable");
      }
      const { id } = c.req.valid("param");
      return c.json({ data: await deps.enrichment.retry(c.get("session").sub, id) }, 200);
    })
    .post(
      "/:id/deliveries/read-later",
      zValidator("param", IdParamSchema),
      (c) => publishDelivery(c, deps, "read_later", c.req.valid("param").id),
    );
}

async function publishDelivery(
  c: Context<AppEnv>,
  deps: AppDependencies,
  kind: "share" | "read_later",
  resourceId: string,
  body: { channelId: string } | undefined = undefined,
) {
  if (!deps.deliveries) return error(c, 503, "DEPENDENCY_ERROR", "Delivery is unavailable");
  return c.json({
    data: await deps.deliveries.publish(c.get("session").sub, resourceId, {
      ...body,
      kind,
    }),
  }, 201);
}
