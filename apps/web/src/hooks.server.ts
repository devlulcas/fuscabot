import type { Handle } from "@sveltejs/kit";
import { localeFromPath } from "$lib/archive.ts";
import { backend } from "$lib/server/backend.ts";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.backend = backend;
  const locale = localeFromPath(event.url.pathname);
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en"', `<html lang="${locale}"`),
  });
  if (event.url.pathname === "/health" || event.url.pathname.startsWith("/v1")) return response;
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  return response;
};
