import { createApp } from "./app.ts";
import {
  allowedExtensionOrigins,
  loadEnv,
  requireRuntimeEnv,
  type RuntimeEnv,
} from "./config/env.ts";
import type { RateLimitStore } from "./http/rate_limit.ts";
import { logInfo } from "./observability/log.ts";

type RuntimeApplication = {
  fetch(request: Request, clientKey: string): Response | Promise<Response>;
  readiness(): Promise<void>;
};

type RuntimeHandlerOptions = {
  build?: (source: Record<string, string>) => Promise<RuntimeApplication>;
  now?: () => number;
  failureCooldownMs?: number;
};

export function startServer(): void {
  const source = Deno.env.toObject();
  const handler = createRuntimeHandler(source);
  const configuredPort = Number(source.PORT ?? 8000);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 8000;
  Deno.serve({ port }, handler);
}

export function createRuntimeHandler(
  source = Deno.env.toObject(),
  options: RuntimeHandlerOptions = {},
) {
  const build = options.build ?? buildRuntimeApp;
  const now = options.now ?? Date.now;
  const failureCooldownMs = options.failureCooldownMs ?? 5_000;
  let runtimeApp: Promise<RuntimeApplication> | undefined;
  let retryAfter = 0;
  const getRuntimeApp = () => {
    if (!runtimeApp && now() < retryAfter) {
      return Promise.reject(new Error("Runtime initialization is cooling down"));
    }
    if (!runtimeApp) {
      runtimeApp = build(source).catch((cause) => {
        runtimeApp = undefined;
        retryAfter = now() + failureCooldownMs;
        throw cause;
      });
    }
    return runtimeApp;
  };
  return async (
    request: Request,
    info?: Deno.ServeHandlerInfo,
  ): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" || pathname === "/healthz") {
      return safeJson({ status: "ok" });
    }
    try {
      const runtime = await getRuntimeApp();
      if (pathname === "/readyz") {
        await runtime.readiness();
        return safeJson({ status: "ready" });
      }
      return await runtime.fetch(request, remoteAddressKey(info));
    } catch {
      return safeJson({
        error: {
          code: "DEPENDENCY_ERROR",
          message: "Service is temporarily unavailable",
          retryable: true,
        },
      }, 503);
    }
  };
}

async function buildRuntimeApp(source: Record<string, string>) {
  let runtimeEnv: RuntimeEnv;
  try {
    runtimeEnv = requireRuntimeEnv(loadEnv(source));
  } catch (cause) {
    throw new Error(`Runtime configuration is invalid: ${safeConfigError(cause)}`);
  }
  const [
    { createAppDatabase, createDatabasePool },
    { bootstrapWorkspace },
    { DiscordClient },
    { MistralClient },
    { PostgresDiscordSetupRepository },
    { PostgresDurableDeliveryRepository },
    { PostgresEnrichmentStore },
    { PostgresResourceRepository },
    { PostgresPublicArchiveRepository },
    { PostgresAuthRepository },
    { DrizzleRateLimitStore },
    { AuthService },
    { DiscordSetupCoordinator },
    { DurableDeliveryCoordinator },
    { EnrichmentService },
    { ResourceService },
    { RuntimePublicationCoordinator },
    { PostgresTagCoordinator },
    { createPublicWebApp },
    {
      discordSnapshotSender,
      RuntimeChannelCoordinator,
      RuntimeDeliveryCoordinator,
      RuntimeEnrichmentCoordinator,
    },
  ] = await Promise.all([
    import("./db/client.ts"),
    import("./db/workspace.ts"),
    import("./integrations/discord_client.ts"),
    import("./integrations/mistral_client.ts"),
    import("./repositories/discord_setup_repository.ts"),
    import("./repositories/durable_delivery_repository.ts"),
    import("./repositories/enrichment_repository.ts"),
    import("./repositories/postgres_resource_repository.ts"),
    import("./repositories/public_archive_repository.ts"),
    import("./repositories/auth_repository.ts"),
    import("./repositories/rate_limit_repository.ts"),
    import("./services/auth_service.ts"),
    import("./services/discord_setup_coordinator.ts"),
    import("./services/durable_delivery_coordinator.ts"),
    import("./services/enrichment_service.ts"),
    import("./services/resource_service.ts"),
    import("./services/publication_coordinator.ts"),
    import("./services/tag_coordinator.ts"),
    import("../../web/mod.ts"),
    import("./services/runtime_coordinators.ts"),
  ]);
  const database = createDatabasePool(runtimeEnv.DATABASE_URL);
  const appDatabase = createAppDatabase(database);
  const workspace = await bootstrapWorkspace(appDatabase, runtimeEnv.OWNER_DISCORD_USER_ID).catch(
    async (cause) => {
      await database.end();
      throw cause;
    },
  );
  const resourceRepository = new PostgresResourceRepository(
    appDatabase,
    runtimeEnv.PUBLIC_SITE_ORIGIN,
  );
  const resourceService = new ResourceService(resourceRepository, workspace.id);
  const extensionOrigins = allowedExtensionOrigins(runtimeEnv.ALLOWED_EXTENSION_ORIGINS);
  const discord = new DiscordClient(runtimeEnv.DISCORD_BOT_TOKEN);
  const setup = new DiscordSetupCoordinator(new PostgresDiscordSetupRepository(appDatabase));
  const enrichment = new EnrichmentService(
    new PostgresEnrichmentStore(appDatabase, "mistral-small-latest"),
    new MistralClient({ apiKey: runtimeEnv.MISTRAL_API_KEY }),
  );
  const durableDelivery = new DurableDeliveryCoordinator(
    new PostgresDurableDeliveryRepository(appDatabase),
    discordSnapshotSender(discord),
  );
  const deliveryCoordinator = new RuntimeDeliveryCoordinator(
    runtimeEnv.OWNER_DISCORD_USER_ID,
    workspace.id,
    resourceRepository,
    setup,
    durableDelivery,
  );
  const rateLimits = new DrizzleRateLimitStore(appDatabase);
  const api = createApp({
    resources: resourceService,
    auth: new AuthService(
      {
        clientId: runtimeEnv.DISCORD_CLIENT_ID,
        clientSecret: runtimeEnv.DISCORD_CLIENT_SECRET,
        redirectUri: runtimeEnv.DISCORD_OAUTH_REDIRECT_URI,
        ownerDiscordUserId: runtimeEnv.OWNER_DISCORD_USER_ID,
        signingSecret: runtimeEnv.APP_SESSION_SIGNING_SECRET,
        extensionRedirectOrigins: extensionOrigins.flatMap(chromiumRedirectOrigin),
      },
      fetch,
      Date.now,
      new PostgresAuthRepository(appDatabase, workspace.id),
    ),
    discord,
    channels: new RuntimeChannelCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      workspace.id,
      setup,
      discord,
    ),
    enrichment: new RuntimeEnrichmentCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      workspace.id,
      resourceRepository,
      setup,
      enrichment,
    ),
    deliveries: deliveryCoordinator,
    publications: new RuntimePublicationCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      resourceService,
      deliveryCoordinator,
    ),
    tags: new PostgresTagCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      workspace.id,
      appDatabase,
    ),
    allowedOrigins: extensionOrigins,
    requireAuth: true,
    rateLimits,
  });
  const publicWeb = createPublicWebApp({
    reader: new PostgresPublicArchiveRepository(appDatabase, workspace.id),
    origin: runtimeEnv.PUBLIC_SITE_ORIGIN,
    umami: runtimeEnv.UMAMI_SCRIPT_URL && runtimeEnv.UMAMI_WEBSITE_ID
      ? {
        scriptUrl: runtimeEnv.UMAMI_SCRIPT_URL,
        websiteId: runtimeEnv.UMAMI_WEBSITE_ID,
        domain: new URL(runtimeEnv.PUBLIC_SITE_ORIGIN).hostname,
        hostUrl: runtimeEnv.UMAMI_HOST_URL,
      }
      : undefined,
  });
  return {
    fetch: async (request: Request, clientKey: string) => {
      const url = new URL(request.url);
      if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
        return await api.fetch(request);
      }
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      let response: Response;
      if (!url.pathname.startsWith("/assets/")) {
        const limited = await publicRateLimit(
          rateLimits,
          clientKey,
          url.searchParams.has("q"),
        );
        if (limited) {
          response = limited;
        } else {
          response = await publicWeb.fetch(request);
        }
      } else {
        response = await publicWeb.fetch(request);
      }
      response.headers.set("x-request-id", requestId);
      logInfo("public_request_complete", {
        requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return response;
    },
    readiness: async () => {
      await database.query("SELECT 1");
    },
  };
}

async function publicRateLimit(
  store: RateLimitStore,
  key: string,
  isSearch: boolean,
): Promise<Response | null> {
  const result = await store.consume({
    scope: isSearch ? "public-search" : "public-pages",
    key,
    limit: isSearch ? 30 : 120,
    windowMs: 60_000,
  });
  if (result.allowed) return null;
  return new Response("Too many requests", {
    status: 429,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "retry-after": String(result.retryAfterSeconds),
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function remoteAddressKey(info?: Deno.ServeHandlerInfo): string {
  const address = info?.remoteAddr;
  if (!address) return "unknown";
  if ("hostname" in address) return address.hostname;
  return `${address.transport}:local`;
}

function chromiumRedirectOrigin(origin: string): string[] {
  const url = new URL(origin);
  return url.protocol === "chrome-extension:" ? [`https://${url.hostname}.chromiumapp.org`] : [];
}

if (import.meta.main) startServer();

function safeConfigError(cause: unknown): string {
  if (
    typeof cause === "object" && cause !== null && "issues" in cause &&
    Array.isArray(cause.issues)
  ) {
    return cause.issues.map((issue: unknown) => {
      if (typeof issue !== "object" || issue === null) return "unknown variable";
      const path = "path" in issue && Array.isArray(issue.path) ? issue.path.join(".") : "unknown";
      const message = "message" in issue ? String(issue.message) : "invalid";
      return `${path}: ${message}`;
    }).join("; ");
  }
  return "unknown configuration error";
}

function safeJson(body: unknown, status = 200): Response {
  const requestId = crypto.randomUUID();
  return Response.json(body, {
    status,
    headers: {
      "x-request-id": requestId,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    },
  });
}
