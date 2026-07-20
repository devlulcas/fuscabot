import type { ChannelPatch, ImportedTextChannel, StoredChannel } from "../domain/discord_setup.ts";
import { ChannelNotFoundError, InvalidReadLaterChannelError } from "../domain/discord_setup.ts";

export interface DiscordSetupStore {
  bootstrapOwner(ownerDiscordUserId: string, name?: string): Promise<string>;
  selectGuild(
    workspaceId: string,
    guild: { id: string; name: string; botUserId: string },
  ): Promise<void>;
  syncChannels(workspaceId: string, channels: ImportedTextChannel[]): Promise<StoredChannel[]>;
  listChannels(workspaceId: string): Promise<StoredChannel[]>;
  updateChannel(
    workspaceId: string,
    channelId: string,
    patch: ChannelPatch,
  ): Promise<StoredChannel | null>;
}

export class DiscordSetupCoordinator {
  constructor(private readonly store: DiscordSetupStore) {}
  bootstrapOwner(ownerId: string, name?: string) {
    return this.store.bootstrapOwner(ownerId, name);
  }
  selectGuild(workspaceId: string, guild: { id: string; name: string; botUserId: string }) {
    return this.store.selectGuild(workspaceId, guild);
  }
  sync(workspaceId: string, channels: ImportedTextChannel[]) {
    return this.store.syncChannels(workspaceId, channels);
  }
  list(workspaceId: string) {
    return this.store.listChannels(workspaceId);
  }
  async update(workspaceId: string, channelId: string, patch: ChannelPatch) {
    if (patch.isReadLater && patch.isActiveForRouting === false) {
      throw new InvalidReadLaterChannelError("Read Later must be active");
    }
    const channel = await this.store.updateChannel(workspaceId, channelId, patch);
    if (!channel) throw new ChannelNotFoundError();
    return channel;
  }
}
