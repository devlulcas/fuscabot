import { z } from "zod";

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
import { fetchWithTimeout, readBoundedJson, UpstreamTimeoutError } from "./http_boundary.ts";

export type DiscordFailureOutcome = "rejected" | "not_sent" | "unknown";

const DiscordTextChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.number().int(),
  parent_id: z.string().nullable(),
  topic: z.string().nullable(),
});
const DiscordGuildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().nullable(),
});
const DiscordMessageSchema = z.object({
  id: z.string().min(1),
  channel_id: z.string().min(1),
});

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
    readonly outcome: DiscordFailureOutcome = "rejected",
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
    private timeoutMs = 10_000,
  ) {}

  async listGuildTextChannels(guildId: string): Promise<DiscordTextChannel[]> {
    const body = await this.call<unknown>(`/guilds/${guildId}/channels`);
    const parsed = z.array(DiscordTextChannelSchema).safeParse(body);
    if (!parsed.success) throw invalidResponse("rejected");
    const channels = parsed.data;
    return channels.filter((channel): channel is DiscordTextChannel => channel.type === 0);
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    const parsed = DiscordGuildSchema.safeParse(
      await this.call<unknown>(`/guilds/${guildId}`),
    );
    if (!parsed.success) throw invalidResponse("rejected");
    return parsed.data;
  }

  async createChannelMessage(
    channelId: string,
    payload: DiscordMessagePayload,
  ): Promise<DiscordMessage> {
    const parsed = DiscordMessageSchema.safeParse(
      await this.call<unknown>(`/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } }),
      }),
    );
    if (!parsed.success) throw invalidResponse("unknown");
    return parsed.data;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isMessageCreate = init.method === "POST" && path.includes("/messages");
    let response: Response;
    try {
      response = await fetchWithTimeout(
        this.request,
        `${this.baseUrl}${path}`,
        {
          ...init,
          headers: { authorization: `Bot ${this.token}`, ...init.headers },
        },
        this.timeoutMs,
        isMessageCreate,
      );
    } catch (cause) {
      if (cause instanceof UpstreamTimeoutError || isMessageCreate) {
        throw new DiscordApiError("Discord request outcome is unknown", 0, null, "unknown");
      }
      throw new DiscordApiError("Discord request failed before completion", 0, null, "not_sent");
    }
    let body: unknown = null;
    try {
      body = await readBoundedJson(response);
    } catch {
      if (response.ok) {
        throw new DiscordApiError(
          "Discord returned an invalid response",
          response.status,
          null,
          isMessageCreate ? "unknown" : "rejected",
        );
      }
    }
    if (!response.ok) {
      const retryHeader = response.headers.get("retry-after");
      const retryBody = typeof body === "object" && body && "retry_after" in body
        ? Number(body.retry_after) * 1000
        : null;
      const candidate = retryHeader ? Number(retryHeader) * 1000 : retryBody;
      const retryAfterMs = candidate !== null && Number.isFinite(candidate) && candidate >= 0
        ? candidate
        : null;
      const outcome: DiscordFailureOutcome = response.status === 429
        ? "not_sent"
        : response.status >= 500 && isMessageCreate
        ? "unknown"
        : "rejected";
      throw new DiscordApiError(
        "Discord rejected the request",
        response.status,
        retryAfterMs,
        outcome,
      );
    }
    return body as T;
  }
}

function invalidResponse(outcome: DiscordFailureOutcome): DiscordApiError {
  return new DiscordApiError("Discord returned an invalid response", 200, null, outcome);
}

export type DiscordMessagePayload = ContractDiscordMessagePayload;
import type { DiscordMessagePayload as ContractDiscordMessagePayload } from "@fuscabot/contracts";
