import { createApp } from "./app.ts";
import { loadEnv, requireRuntimeEnv } from "./config/env.ts";
import { DiscordClient } from "./integrations/discord_client.ts";
import { InMemoryResourceRepository } from "./repositories/resource_repository.ts";
import { AuthService } from "./services/auth_service.ts";
import { ResourceService } from "./services/resource_service.ts";

if (import.meta.main) {
  const env = requireRuntimeEnv(loadEnv());
  const app = createApp({
    resources: new ResourceService(new InMemoryResourceRepository()),
    auth: new AuthService({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      redirectUri: env.DISCORD_OAUTH_REDIRECT_URI,
      ownerDiscordUserId: env.OWNER_DISCORD_USER_ID,
      signingSecret: env.APP_SESSION_SIGNING_SECRET,
    }),
    discord: new DiscordClient(env.DISCORD_BOT_TOKEN),
    allowedOrigins: env.ALLOWED_EXTENSION_ORIGINS.split(",").map((value) => value.trim()).filter(
      Boolean,
    ),
  });
  Deno.serve({ port: env.PORT }, app.fetch);
}
