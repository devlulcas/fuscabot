import { createApp } from "./app.ts";
import { loadEnv } from "./config/env.ts";

if (import.meta.main) {
  const env = loadEnv();
  Deno.serve({ port: env.PORT }, createApp().fetch);
}
