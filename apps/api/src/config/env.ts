import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().url().optional(),
  OWNER_DISCORD_USER_ID: z.string().min(1).optional(),
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  DISCORD_OAUTH_REDIRECT_URI: z.string().url().optional(),
  MISTRAL_API_KEY: z.string().min(1).optional(),
  APP_SESSION_SIGNING_SECRET: z.string().min(32).optional(),
  ALLOWED_EXTENSION_ORIGINS: z.string().default("http://localhost:8000"),
});

export type Env = z.infer<typeof EnvSchema>;

const RuntimeEnvSchema = EnvSchema.extend({
  DATABASE_URL: z.string().url(),
  OWNER_DISCORD_USER_ID: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_OAUTH_REDIRECT_URI: z.url(),
  APP_SESSION_SIGNING_SECRET: z.string().min(32),
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = Deno.env.toObject()): Env {
  return EnvSchema.parse(source);
}

export function requireRuntimeEnv(env: Env): RuntimeEnv {
  return RuntimeEnvSchema.parse(env);
}
