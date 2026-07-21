export type DiscordTextChannel = {
  id: string;
  name: string;
  type: 0;
  parent_id: string | null;
  topic: string | null;
};

export type DiscordMessage = { id: string; channel_id: string };
export type DiscordGuild = { id: string; name: string; icon: string | null };
export type DiscordFetch = typeof fetch;

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

export class DiscordClient {
  constructor(
    private token: string,
    private request: DiscordFetch = fetch,
    private baseUrl = "https://discord.com/api/v10",
  ) {}

  async listGuildTextChannels(guildId: string): Promise<DiscordTextChannel[]> {
    const channels = await this.call<Array<DiscordTextChannel & { type: number }>>(
      `/guilds/${guildId}/channels`,
    );
    return channels.filter((channel): channel is DiscordTextChannel => channel.type === 0);
  }

  getGuild(guildId: string): Promise<DiscordGuild> {
    return this.call(`/guilds/${guildId}`);
  }

  createChannelMessage(channelId: string, payload: DiscordMessagePayload): Promise<DiscordMessage> {
    return this.call(`/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } }),
    });
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bot ${this.token}`, ...init.headers },
    });
    const body = await parseJson(response);
    if (!response.ok) {
      const retryHeader = response.headers.get("retry-after");
      const retryBody = typeof body === "object" && body && "retry_after" in body
        ? Number(body.retry_after) * 1000
        : null;
      const retryAfterMs = retryHeader ? Number(retryHeader) * 1000 : retryBody;
      const detail = typeof body === "object" && body && "message" in body
        ? String(body.message)
        : `HTTP ${response.status}`;
      throw new DiscordApiError(`Discord request failed: ${detail}`, response.status, retryAfterMs);
    }
    return body as T;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) return null;
    throw new DiscordApiError("Discord returned invalid JSON", response.status, null);
  }
}

export type DiscordMessagePayload = ContractDiscordMessagePayload;
import type { DiscordMessagePayload as ContractDiscordMessagePayload } from "@fuscabot/contracts";
