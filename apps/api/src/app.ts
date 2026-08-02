import { Hono } from "@hono/hono";
import { bodyLimit } from "@hono/hono/body-limit";
import type { ApplyGlobalResponse } from "@hono/hono/client";
import type { ApiError } from "@fuscabot/contracts";
import type {
  AppDependencies,
  AppEnv,
  ChannelCoordinator,
  ChannelRecord,
  DeliveryCoordinator,
  EnrichmentCoordinator,
  TagCoordinator,
} from "./app_types.ts";
import { error, handleError } from "./http/errors.ts";
import { DEFAULT_MAX_JSON_BYTES } from "./http/json_body.ts";
import {
  authenticate,
  authenticatedRateLimit,
  requestLifecycle,
} from "./middleware/app_middleware.ts";
import { InMemoryResourceRepository } from "./repositories/resource_repository.ts";
import { createAuthRoutes } from "./routes/auth_routes.ts";
import { createDeliveryRoutes } from "./routes/delivery_routes.ts";
import { createDiscordRoutes } from "./routes/discord_routes.ts";
import { createResourceRoutes } from "./routes/resource_routes.ts";
import { createTagRoutes } from "./routes/tag_routes.ts";
import { ResourceService } from "./services/resource_service.ts";

export type {
  AppDependencies,
  ChannelCoordinator,
  ChannelRecord,
  DeliveryCoordinator,
  EnrichmentCoordinator,
  TagCoordinator,
};

export function createApp(
  deps: AppDependencies = { resources: new ResourceService(new InMemoryResourceRepository()) },
) {
  const app = new Hono<AppEnv>();

  app.onError((cause, c) => handleError(c, cause));
  app.notFound((c) => error(c, 404, "NOT_FOUND", "Route not found"));
  app.use("*", requestLifecycle(deps));

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: deps.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES,
      onError: (c) => error(c, 413, "PAYLOAD_TOO_LARGE", "Request body is too large"),
    }),
  );
  app.use("/v1/*", authenticate(deps));
  app.use("/v1/*", authenticatedRateLimit(deps));

  const routes = app
    .route("/v1/auth", createAuthRoutes(deps))
    .route("/v1", createDiscordRoutes(deps))
    .route("/v1/resources", createResourceRoutes(deps))
    .route("/v1/deliveries", createDeliveryRoutes(deps))
    .route("/v1/tags", createTagRoutes(deps));

  return routes;
}

export const app = createApp();

type GlobalErrorResponses = {
  400: { json: ApiError };
  401: { json: ApiError };
  403: { json: ApiError };
  404: { json: ApiError };
  409: { json: ApiError };
  413: { json: ApiError };
  429: { json: ApiError };
  500: { json: ApiError };
  502: { json: ApiError };
  503: { json: ApiError };
};

export type AppType = ApplyGlobalResponse<typeof app, GlobalErrorResponses>;
