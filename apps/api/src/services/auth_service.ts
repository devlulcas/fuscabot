import { z } from "zod";
import { fetchWithTimeout, readBoundedJson } from "../integrations/http_boundary.ts";

const DISCORD_API = "https://discord.com/api/v10";
const BOT_PERMISSIONS = "19456";
const OAUTH_SCOPES = "identify guilds bot";

const StateSchema = z.object({
  nonce: z.string().min(16),
  exp: z.number().int().positive(),
  extensionRedirect: z.url(),
});

const SessionSchema = z.object({
  sub: z.string().min(1),
  sid: z.uuid(),
  guildIds: z.array(z.string().min(1)).max(100),
  exp: z.number().int().positive(),
});

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  guild: z.object({ id: z.string().min(1) }).optional(),
});

const UserSchema = z.object({ id: z.string().min(1) });
const UserGuildSchema = z.object({
  id: z.string().min(1),
  owner: z.boolean().optional(),
  permissions: z.string().optional(),
});

export type AuthFetch = typeof fetch;
export type SessionClaims = z.infer<typeof SessionSchema>;

export type AuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  ownerDiscordUserId: string;
  signingSecret: string;
  extensionRedirectOrigins?: string[];
};

export interface AuthPersistence {
  saveState(hash: string, expiresAt: Date): Promise<void>;
  consumeState(hash: string, now: Date): Promise<boolean>;
  createSession(hash: string, expiresAt: Date, guildIds: string[]): Promise<string>;
  rotateSession(
    id: string,
    previousHash: string,
    nextHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<string[] | null>;
  isSessionActive(id: string, now: Date): Promise<boolean>;
  revokeSession(id: string, now: Date): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 502,
    readonly code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "DEPENDENCY_ERROR",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthService {
  readonly #key: Promise<CryptoKey>;

  constructor(
    private config: AuthConfig,
    private request: AuthFetch = fetch,
    private now: () => number = Date.now,
    private persistence: AuthPersistence = new InMemoryAuthPersistence(),
  ) {
    this.#key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(config.signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  async authorizationUrl(extensionRedirect: string): Promise<string> {
    validateExtensionRedirect(extensionRedirect, this.config.extensionRedirectOrigins);
    const nonce = crypto.randomUUID();
    const expiresAt = this.now() + 10 * 60_000;
    await this.persistence.saveState(await sha256(nonce), new Date(expiresAt));
    const state = await this.#sign({
      nonce,
      exp: expiresAt,
      extensionRedirect,
    });
    const url = new URL("https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      permissions: BOT_PERMISSIONS,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      integration_type: "0",
      scope: OAUTH_SCOPES,
      state,
      prompt: "consent",
    }).toString();
    return url.href;
  }

  async complete(code: string, stateToken: string): Promise<{
    extensionRedirect: string;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    let state: z.infer<typeof StateSchema>;
    try {
      state = StateSchema.parse(await this.#verify(stateToken));
    } catch {
      throw new AuthError("OAuth state is invalid", 400, "BAD_REQUEST");
    }
    if (state.exp < this.now()) {
      throw new AuthError("OAuth state expired", 400, "BAD_REQUEST");
    }
    if (!await this.persistence.consumeState(await sha256(state.nonce), new Date(this.now()))) {
      throw new AuthError("OAuth state was already used or expired", 400, "BAD_REQUEST");
    }
    validateExtensionRedirect(state.extensionRedirect, this.config.extensionRedirectOrigins);

    const token = await this.#exchangeCode(code);
    let user: z.infer<typeof UserSchema>;
    let userGuilds: Array<z.infer<typeof UserGuildSchema>>;
    try {
      [user, userGuilds] = await Promise.all([
        this.#discordGet("/users/@me", token.access_token).then((value) => UserSchema.parse(value)),
        this.#discordGet("/users/@me/guilds", token.access_token).then((value) =>
          z.array(UserGuildSchema).parse(value)
        ),
      ]);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError("Discord returned an invalid identity response", 502, "DEPENDENCY_ERROR");
    }
    if (user.id !== this.config.ownerDiscordUserId) {
      throw new AuthError("This Discord account is not allowed", 403, "FORBIDDEN");
    }

    const guildIds = userGuilds.filter(canManageGuild).map((guild) => guild.id);
    if (token.guild && !guildIds.includes(token.guild.id)) guildIds.push(token.guild.id);
    const refreshToken = randomToken();
    const sessionId = await this.persistence.createSession(
      await sha256(refreshToken),
      new Date(this.now() + 30 * 24 * 60 * 60_000),
      guildIds.slice(0, 100),
    );
    const accessToken = await this.#accessToken(user.id, sessionId, guildIds);
    return { extensionRedirect: state.extensionRedirect, accessToken, refreshToken, sessionId };
  }

  async refresh(sessionId: string, refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const next = randomToken();
    const guildIds = await this.persistence.rotateSession(
      sessionId,
      await sha256(refreshToken),
      await sha256(next),
      new Date(this.now() + 30 * 24 * 60 * 60_000),
      new Date(this.now()),
    );
    if (!guildIds) throw new AuthError("Refresh session is invalid", 401, "UNAUTHORIZED");
    return {
      accessToken: await this.#accessToken(this.config.ownerDiscordUserId, sessionId, guildIds),
      refreshToken: next,
    };
  }

  revoke(sessionId: string): Promise<void> {
    return this.persistence.revokeSession(sessionId, new Date(this.now()));
  }

  async verifySession(token: string): Promise<SessionClaims> {
    try {
      const claims = SessionSchema.parse(await this.#verify(token));
      if (
        claims.exp < this.now() || claims.sub !== this.config.ownerDiscordUserId ||
        !await this.persistence.isSessionActive(claims.sid, new Date(this.now()))
      ) {
        throw new Error("expired");
      }
      return claims;
    } catch {
      throw new AuthError("Session is invalid or expired", 401, "UNAUTHORIZED");
    }
  }

  #accessToken(sub: string, sid: string, guildIds: string[]): Promise<string> {
    return this.#sign({
      sub,
      sid,
      guildIds: guildIds.slice(0, 100),
      exp: this.now() + 15 * 60_000,
    });
  }

  async #exchangeCode(code: string): Promise<z.infer<typeof TokenResponseSchema>> {
    let response: Response;
    let body: unknown;
    try {
      response = await fetchWithTimeout(this.request, `${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.redirectUri,
        }),
      }, 10_000);
      body = await readBoundedJson(response);
    } catch {
      throw new AuthError("Discord OAuth is temporarily unavailable", 502, "DEPENDENCY_ERROR");
    }
    if (!response.ok) {
      throw new AuthError("Discord rejected the OAuth code", 502, "DEPENDENCY_ERROR");
    }
    try {
      return TokenResponseSchema.parse(body);
    } catch {
      throw new AuthError("Discord returned an invalid OAuth response", 502, "DEPENDENCY_ERROR");
    }
  }

  async #discordGet(path: string, accessToken: string): Promise<unknown> {
    let response: Response;
    let body: unknown;
    try {
      response = await fetchWithTimeout(this.request, `${DISCORD_API}${path}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }, 10_000);
      body = await readBoundedJson(response);
    } catch {
      throw new AuthError("Discord identity is temporarily unavailable", 502, "DEPENDENCY_ERROR");
    }
    if (!response.ok) {
      throw new AuthError("Discord identity request failed", 502, "DEPENDENCY_ERROR");
    }
    return body;
  }

  async #sign(payload: unknown): Promise<string> {
    const encoded = base64UrlEncode(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.#key,
      new TextEncoder().encode(encoded),
    );
    return `${encoded}.${base64UrlEncode(signature)}`;
  }

  async #verify(token: string): Promise<unknown> {
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) throw new Error("Malformed token");
    const valid = await crypto.subtle.verify(
      "HMAC",
      await this.#key,
      base64UrlDecode(signature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) throw new Error("Invalid signature");
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
  }
}

export class InMemoryAuthPersistence implements AuthPersistence {
  readonly #states = new Map<string, number>();
  readonly #sessions = new Map<
    string,
    { hash: string; expires: number; revoked: boolean; guildIds: string[] }
  >();
  saveState(hash: string, expiresAt: Date): Promise<void> {
    this.#states.set(hash, expiresAt.getTime());
    return Promise.resolve();
  }
  consumeState(hash: string, now: Date): Promise<boolean> {
    const expiry = this.#states.get(hash);
    if (!expiry || expiry <= now.getTime()) return Promise.resolve(false);
    this.#states.delete(hash);
    return Promise.resolve(true);
  }
  createSession(hash: string, expiresAt: Date, guildIds: string[]): Promise<string> {
    const id = crypto.randomUUID();
    this.#sessions.set(id, { hash, expires: expiresAt.getTime(), revoked: false, guildIds });
    return Promise.resolve(id);
  }
  rotateSession(id: string, previousHash: string, nextHash: string, expiresAt: Date, now: Date) {
    const session = this.#sessions.get(id);
    if (
      !session || session.revoked || session.expires <= now.getTime() ||
      session.hash !== previousHash
    ) {
      return Promise.resolve(null);
    }
    this.#sessions.set(id, { ...session, hash: nextHash, expires: expiresAt.getTime() });
    return Promise.resolve(session.guildIds);
  }
  isSessionActive(id: string, now: Date): Promise<boolean> {
    const session = this.#sessions.get(id);
    return Promise.resolve(Boolean(session && !session.revoked && session.expires > now.getTime()));
  }
  revokeSession(id: string): Promise<void> {
    const session = this.#sessions.get(id);
    if (session) session.revoked = true;
    return Promise.resolve();
  }
}

function canManageGuild(guild: z.infer<typeof UserGuildSchema>): boolean {
  if (guild.owner) return true;
  const permissions = BigInt(guild.permissions ?? "0");
  return (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;
}

function validateExtensionRedirect(value: string, allowedOrigins?: string[]): void {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !/^[a-p]{32}\.chromiumapp\.org$/.test(url.hostname) || url.pathname !== "/discord" ||
    url.search !== "" || url.hash !== "" ||
    (allowedOrigins !== undefined && !allowedOrigins.includes(url.origin))
  ) {
    throw new AuthError("Invalid extension redirect", 400, "BAD_REQUEST");
  }
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes.buffer as ArrayBuffer);
}

async function sha256(value: string): Promise<string> {
  return base64UrlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
