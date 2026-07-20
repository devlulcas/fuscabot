import { createApp } from "./app.ts";
import { loadEnv, requireRuntimeEnv, type RuntimeEnv } from "./config/env.ts";

export function startServer(): void {
  const source = Deno.env.toObject();
  const handler = createRuntimeHandler(source);
  const configuredPort = Number(source.PORT ?? 8000);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 8000;
  Deno.serve({ port }, handler);
}

export function createRuntimeHandler(source = Deno.env.toObject()) {
  let runtimeApp: Promise<ReturnType<typeof createApp>> | undefined;
  const getRuntimeApp = () => {
    if (!runtimeApp) {
      runtimeApp = buildRuntimeApp(source).catch((cause) => {
        runtimeApp = undefined;
        throw cause;
      });
    }
    return runtimeApp;
  };
  return async (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" || pathname === "/") {
      return Response.json({
        status: "ok",
        services: { auth: true, discord: true, database: true, mistral: true },
      });
    }
    return (await getRuntimeApp()).fetch(request);
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
    { createDatabasePool },
    { queryAdapter },
    { loadMigrations },
    { runMigrations },
    { bootstrapWorkspace },
    { DiscordClient },
    { MistralClient },
    { PostgresDiscordSetupRepository },
    { PostgresDurableDeliveryRepository },
    { PostgresEnrichmentStore },
    { PostgresResourceRepository },
    { PostgresAuthRepository },
    { AuthService },
    { DiscordSetupCoordinator },
    { DurableDeliveryCoordinator },
    { EnrichmentService },
    { ResourceService },
    { PostgresTagCoordinator },
    {
      discordSnapshotSender,
      RuntimeChannelCoordinator,
      RuntimeDeliveryCoordinator,
      RuntimeEnrichmentCoordinator,
    },
  ] = await Promise.all([
    import("./db/client.ts"),
    import("./db/query_adapter.ts"),
    import("./db/migrate.ts"),
    import("./db/migrations.ts"),
    import("./db/workspace.ts"),
    import("./integrations/discord_client.ts"),
    import("./integrations/mistral_client.ts"),
    import("./repositories/discord_setup_repository.ts"),
    import("./repositories/durable_delivery_repository.ts"),
    import("./repositories/enrichment_repository.ts"),
    import("./repositories/postgres_resource_repository.ts"),
    import("./repositories/auth_repository.ts"),
    import("./services/auth_service.ts"),
    import("./services/discord_setup_coordinator.ts"),
    import("./services/durable_delivery_coordinator.ts"),
    import("./services/enrichment_service.ts"),
    import("./services/resource_service.ts"),
    import("./services/tag_coordinator.ts"),
    import("./services/runtime_coordinators.ts"),
  ]);
  const database = createDatabasePool(runtimeEnv.DATABASE_URL);
  await runMigrations(
    database,
    await loadMigrations(new URL("../migrations/", import.meta.url)),
  );
  const workspace = await bootstrapWorkspace(database, runtimeEnv.OWNER_DISCORD_USER_ID).catch(
    async (cause) => {
      await database.end();
      throw cause;
    },
  );
  const sql = queryAdapter(database);
  const resourceRepository = new PostgresResourceRepository(database);
  const discord = new DiscordClient(runtimeEnv.DISCORD_BOT_TOKEN);
  const setup = new DiscordSetupCoordinator(new PostgresDiscordSetupRepository(sql));
  const enrichment = new EnrichmentService(
    new PostgresEnrichmentStore(sql, "mistral-small-latest"),
    new MistralClient({ apiKey: runtimeEnv.MISTRAL_API_KEY }),
  );
  const durableDelivery = new DurableDeliveryCoordinator(
    new PostgresDurableDeliveryRepository(sql),
    discordSnapshotSender(discord),
  );
  return createApp({
    resources: new ResourceService(resourceRepository, workspace.id),
    auth: new AuthService(
      {
        clientId: runtimeEnv.DISCORD_CLIENT_ID,
        clientSecret: runtimeEnv.DISCORD_CLIENT_SECRET,
        redirectUri: runtimeEnv.DISCORD_OAUTH_REDIRECT_URI,
        ownerDiscordUserId: runtimeEnv.OWNER_DISCORD_USER_ID,
        signingSecret: runtimeEnv.APP_SESSION_SIGNING_SECRET,
      },
      fetch,
      Date.now,
      new PostgresAuthRepository(sql, workspace.id),
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
    deliveries: new RuntimeDeliveryCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      workspace.id,
      resourceRepository,
      setup,
      durableDelivery,
    ),
    tags: new PostgresTagCoordinator(
      runtimeEnv.OWNER_DISCORD_USER_ID,
      workspace.id,
      sql,
    ),
    allowedOrigins: (source.ALLOWED_EXTENSION_ORIGINS ?? "").split(",").map((value) => value.trim())
      .filter(Boolean),
    requireAuth: true,
  });
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
