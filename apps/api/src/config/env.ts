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
  ALLOWED_EXTENSION_ORIGINS: z.string().optional(),
  PUBLIC_SITE_ORIGIN: z.string().url().optional(),
  UMAMI_SCRIPT_URL: z.string().url().optional(),
  UMAMI_WEBSITE_ID: z.string().uuid().optional(),
  UMAMI_HOST_URL: z.string().url().optional(),
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
  MISTRAL_API_KEY: z.string().min(1),
  ALLOWED_EXTENSION_ORIGINS: z.string().min(1),
  PUBLIC_SITE_ORIGIN: z.string().url(),
}).superRefine((env, context) => {
  for (const origin of env.ALLOWED_EXTENSION_ORIGINS.split(",").map((value) => value.trim())) {
    if (!isAllowedExtensionOrigin(origin)) {
      context.addIssue({
        code: "custom",
        path: ["ALLOWED_EXTENSION_ORIGINS"],
        message: "Origins must be exact Chrome extension origins or local development origins",
      });
    }
  }
  if (!isPublicOrigin(env.PUBLIC_SITE_ORIGIN)) {
    context.addIssue({
      code: "custom",
      path: ["PUBLIC_SITE_ORIGIN"],
      message: "Must be an exact HTTPS origin or a local HTTP development origin",
    });
  }
  const configuredUmami = env.UMAMI_SCRIPT_URL !== undefined ||
    env.UMAMI_WEBSITE_ID !== undefined || env.UMAMI_HOST_URL !== undefined;
  if (
    configuredUmami && (env.UMAMI_SCRIPT_URL === undefined || env.UMAMI_WEBSITE_ID === undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["UMAMI_SCRIPT_URL"],
      message: "UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID must be configured together",
    });
  }
  for (const key of ["UMAMI_SCRIPT_URL", "UMAMI_HOST_URL"] as const) {
    const value = env[key];
    if (value !== undefined && !isSecureWebUrl(value)) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Must use HTTPS or local HTTP development",
      });
    }
  }
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = Deno.env.toObject()): Env {
  return EnvSchema.parse(source);
}

export function requireRuntimeEnv(env: Env): RuntimeEnv {
  return RuntimeEnvSchema.parse(env);
}

export function allowedExtensionOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedExtensionOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.username || url.password || !["", "/"].includes(url.pathname) || url.search || url.hash
    ) return false;
    if (url.protocol === "chrome-extension:") return /^[a-p]{32}$/.test(url.hostname);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isPublicOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username === "" && url.password === "" &&
      ["", "/"].includes(url.pathname) && url.search === "" && url.hash === "" &&
      isSecureWebUrl(value);
  } catch {
    return false;
  }
}

function isSecureWebUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === "https:" ||
    (url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
}
