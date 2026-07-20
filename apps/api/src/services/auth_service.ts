import { z } from "zod";

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
};

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
    validateExtensionRedirect(extensionRedirect);
    const state = await this.#sign({
      nonce: crypto.randomUUID(),
      exp: this.now() + 10 * 60_000,
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
    validateExtensionRedirect(state.extensionRedirect);

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
    const accessToken = await this.#sign({
      sub: user.id,
      guildIds: guildIds.slice(0, 100),
      exp: this.now() + 60 * 60_000,
    });
    return { extensionRedirect: state.extensionRedirect, accessToken };
  }

  async verifySession(token: string): Promise<SessionClaims> {
    try {
      const claims = SessionSchema.parse(await this.#verify(token));
      if (claims.exp < this.now() || claims.sub !== this.config.ownerDiscordUserId) {
        throw new Error("expired");
      }
      return claims;
    } catch {
      throw new AuthError("Session is invalid or expired", 401, "UNAUTHORIZED");
    }
  }

  async #exchangeCode(code: string): Promise<z.infer<typeof TokenResponseSchema>> {
    const response = await this.request(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });
    const body = await response.json().catch(() => null);
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
    const response = await this.request(`${DISCORD_API}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json().catch(() => null);
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

function canManageGuild(guild: z.infer<typeof UserGuildSchema>): boolean {
  if (guild.owner) return true;
  const permissions = BigInt(guild.permissions ?? "0");
  return (permissions & 0x8n) !== 0n || (permissions & 0x20n) !== 0n;
}

function validateExtensionRedirect(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !/^[a-p]{32}\.chromiumapp\.org$/.test(url.hostname)
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
