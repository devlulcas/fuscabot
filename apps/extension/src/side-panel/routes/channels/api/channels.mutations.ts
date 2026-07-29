import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type DiscordChannel } from "../../../../shared/api.ts";
import { getConfig, saveConfig } from "../../../../shared/config.ts";
import { channelQueryKeys } from "./channels.queries.ts";
import type { ChannelPatch } from "../model/channel-types.ts";

export function syncChannelsMutationOptions(
  queryClient: QueryClient,
  setMessage: (message: string) => void,
) {
  return mutationOptions({
    mutationFn: async (guildId: string) => {
      const rows = await api.syncChannels(guildId);
      await saveConfig({ ...await getConfig(), selectedGuildId: guildId });
      return rows;
    },
    onSuccess: (rows) => {
      queryClient.setQueryData(channelQueryKeys.channels, rows);
      void queryClient.invalidateQueries({ queryKey: channelQueryKeys.guilds });
      setMessage(`Synced ${rows.length} channels.`);
    },
  });
}

export function updateChannelMutationOptions() {
  return mutationOptions({
    mutationFn: ({ id, patch }: { id: string; patch: ChannelPatch }) =>
      api.updateChannel(id, patch),
  });
}

export function useChannelMutations(
  clearDirty: (id: string) => void,
  setMessage: (message: string) => void,
) {
  const queryClient = useQueryClient();
  const sync = useMutation(
    syncChannelsMutationOptions(queryClient, setMessage),
  );
  const update = useMutation({
    ...updateChannelMutationOptions(),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<DiscordChannel[]>(
        channelQueryKeys.channels,
        (current) =>
          current?.map((channel) =>
            channel.id === updated.id
              ? updated
              : updated.isReadLater
              ? { ...channel, isReadLater: false }
              : channel
          ),
      );
      clearDirty(variables.id);
      setMessage("Channel settings saved.");
    },
  });
  return {
    sync,
    update,
  };
}
