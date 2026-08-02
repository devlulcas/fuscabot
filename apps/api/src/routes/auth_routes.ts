import { Hono } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnv } from "../app_types.ts";
import { error } from "../http/errors.ts";
import { zValidator } from "../http/validation.ts";

const ExtensionRedirectQuerySchema = z.object({ extension_redirect: z.url() });
const CallbackQuerySchema = z.object({ code: z.string().min(1), state: z.string().min(1) });
const RefreshBodySchema = z.object({
  sessionId: z.uuid(),
  refreshToken: z.string().min(32),
});

export function createAuthRoutes(deps: AppDependencies) {
  return new Hono<AppEnv>()
    .get("/discord/start", zValidator("query", ExtensionRedirectQuerySchema), async (c) => {
      if (!deps.auth) {
        return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
      }
      const query = c.req.valid("query");
      return c.redirect(await deps.auth.authorizationUrl(query.extension_redirect));
    })
    .get("/discord/callback", zValidator("query", CallbackQuerySchema), async (c) => {
      if (!deps.auth) {
        return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
      }
      const query = c.req.valid("query");
      const result = await deps.auth.complete(query.code, query.state);
      const destination = new URL(result.extensionRedirect);
      destination.hash = new URLSearchParams({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        session_id: result.sessionId,
      }).toString();
      return c.redirect(destination.href);
    })
    .post("/refresh", zValidator("json", RefreshBodySchema), async (c) => {
      if (!deps.auth) {
        return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
      }
      const body = c.req.valid("json");
      return c.json({ data: await deps.auth.refresh(body.sessionId, body.refreshToken) }, 200);
    })
    .post("/logout", async (c) => {
      if (!deps.auth) {
        return error(c, 503, "DEPENDENCY_ERROR", "Authentication is not configured");
      }
      await deps.auth.revoke(c.get("session").sid);
      return c.body(null, 204);
    })
    .get("/session", (c) => {
      const session = c.get("session");
      return c.json({
        data: {
          discordUserId: session.sub,
          guildIds: session.guildIds,
          expiresAt: new Date(session.exp).toISOString(),
        },
      }, 200);
    });
}
