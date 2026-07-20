import { createApp } from "./app.ts";
import { loadEnv, requireRuntimeEnv } from "./config/env.ts";
import { createDatabasePool } from "./db/client.ts";
import { bootstrapWorkspace } from "./db/workspace.ts";
import { DiscordClient } from "./integrations/discord_client.ts";
import { PostgresResourceRepository } from "./repositories/postgres_resource_repository.ts";
import { AuthService } from "./services/auth_service.ts";
import { ResourceService } from "./services/resource_service.ts";

export async function startServer(): Promise<void> {
  const source = Deno.env.toObject();
  let runtimeEnv: ReturnType<typeof requireRuntimeEnv>;
  try {
    runtimeEnv = requireRuntimeEnv(loadEnv(source));
  } catch (cause) {
    throw new Error(`Runtime configuration is invalid: ${safeConfigError(cause)}`);
  }
  const database = createDatabasePool(runtimeEnv.DATABASE_URL);
  let workspace;
  try {
    workspace = await bootstrapWorkspace(database, runtimeEnv.OWNER_DISCORD_USER_ID);
  } catch (cause) {
    await database.end();
    throw cause;
  }
  const app = createApp({
    resources: new ResourceService(new PostgresResourceRepository(database), workspace.id),
    auth: new AuthService({
      clientId: runtimeEnv.DISCORD_CLIENT_ID,
      clientSecret: runtimeEnv.DISCORD_CLIENT_SECRET,
      redirectUri: runtimeEnv.DISCORD_OAUTH_REDIRECT_URI,
      ownerDiscordUserId: runtimeEnv.OWNER_DISCORD_USER_ID,
      signingSecret: runtimeEnv.APP_SESSION_SIGNING_SECRET,
    }),
    discord: new DiscordClient(runtimeEnv.DISCORD_BOT_TOKEN),
    allowedOrigins: (source.ALLOWED_EXTENSION_ORIGINS ?? "").split(",").map((value) => value.trim())
      .filter(Boolean),
    requireAuth: true,
  });
  const configuredPort = Number(source.PORT ?? 8000);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 8000;
  Deno.serve({ port }, app.fetch);
}

if (import.meta.main) await startServer();

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
