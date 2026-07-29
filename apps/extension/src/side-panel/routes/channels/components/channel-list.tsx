import type { DiscordChannel } from "../../../../shared/api.ts";
import { InlineNotice } from "../../../components/page-status/page-status.tsx";
import css from "./channel-list.module.css";
import type { ChannelPatch } from "../model/channel-types.ts";
import { ChannelForm } from "./channel-form.tsx";

export function ChannelList({
  channels,
  pending,
  onDirty,
  onSave,
}: {
  channels: DiscordChannel[];
  pending: boolean;
  onDirty: (id: string) => void;
  onSave: (id: string, patch: ChannelPatch) => void;
}) {
  if (!channels.length) {
    return <InlineNotice>No imported text channels yet.</InlineNotice>;
  }
  return (
    <div className={css.channelList}>
      {channels.map((channel) => (
        <ChannelForm
          key={channel.id}
          channel={channel}
          pending={pending}
          onDirty={() => onDirty(channel.id)}
          onSave={(patch) => onSave(channel.id, patch)}
        />
      ))}
    </div>
  );
}
