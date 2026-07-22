import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type DiscordChannel } from "../../../shared/api.ts";
import { getConfig, saveConfig } from "../../../shared/config.ts";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import page from "../../components/layout/page.module.css";
import { channelsQuery, configQuery, guildsQuery } from "../../data/queries.ts";
import { queryKeys } from "../../data/query-keys.ts";

export function ChannelsRoute() {
  const client = useQueryClient();
  const config = useQuery(configQuery());
  const guilds = useQuery(guildsQuery());
  const channels = useQuery(channelsQuery());
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const sync = useMutation({
    mutationFn: async (guildId: string) => {
      const rows = await api.syncChannels(guildId);
      await saveConfig({ ...await getConfig(), selectedGuildId: guildId });
      return rows;
    },
    onSuccess: (rows) => {
      client.setQueryData(queryKeys.channels, rows);
      void client.invalidateQueries({ queryKey: queryKeys.config });
      setMessage(`Synced ${rows.length} channels.`);
    },
  });
  const update = useMutation({
    mutationFn: (
      { id, patch }: {
        id: string;
        patch: Parameters<typeof api.updateChannel>[1];
      },
    ) => api.updateChannel(id, patch),
    onSuccess: (updated, variables) => {
      client.setQueryData<DiscordChannel[]>(
        queryKeys.channels,
        (current) =>
          current?.map((channel) =>
            channel.id === updated.id
              ? updated
              : updated.isReadLater
              ? { ...channel, isReadLater: false }
              : channel
          ),
      );
      setDirty((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      setMessage("Channel settings saved.");
    },
  });
  if (config.isPending || guilds.isPending || channels.isPending) {
    return <PageLoading label="Loading channels…" />;
  }
  if (guilds.isError || channels.isError) {
    const error = guilds.error ?? channels.error;
    return (
      <PageError
        error={error}
        retry={() => {
          void guilds.refetch();
          void channels.refetch();
        }}
      />
    );
  }
  const available = channels.data.filter((channel) =>
    channel.availability === "available"
  );
  const readLater = available.find((channel) => channel.isReadLater)?.id ?? "";
  return (
    <section className={`${page.stack} ${page.settings}`}>
      <h1>Channels</h1>
      <section className={`${page.card} ${page.settingsCard}`}>
        <div className={page.sectionHeading}>
          <div>
            <h2>Discord Channels</h2>
            <p className={page.muted}>
              Choose a server, sync its channels, then configure routing.
            </p>
          </div>
        </div>
        <form
          className={page.form}
          onSubmit={(event) => {
            event.preventDefault();
            const guildId = new FormData(event.currentTarget).get("guildId");
            if (typeof guildId === "string" && guildId) sync.mutate(guildId);
          }}
        >
          <label>
            Server<select
              name="guildId"
              defaultValue={config.data?.selectedGuildId ?? guilds.data[0]?.id}
            >
              {guilds.data.map((guild) => (
                <option key={guild.id} value={guild.id}>{guild.name}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={`${page.button} ${page.primary}`}
            disabled={!guilds.data.length || sync.isPending}
          >
            {sync.isPending ? "Syncing…" : "Sync Channels Now"}
          </button>
        </form>
        {message ? <InlineNotice>{message}</InlineNotice> : null}
        {channels.isRefetchError
          ? (
            <InlineNotice error>
              Couldn’t refresh channels. Showing saved data.
            </InlineNotice>
          )
          : null}
        {sync.error || update.error
          ? (
            <InlineNotice error>
              {(sync.error ?? update.error)?.message}
            </InlineNotice>
          )
          : null}
        <label className={page.form}>
          Read Later Destination<select
            value={readLater}
            onChange={(event) => {
              const next = event.target.value;
              const previous = readLater;
              if (next) {
                update.mutate({
                  id: next,
                  patch: { isReadLater: true, isActiveForRouting: true },
                });
              } else if (previous) {
                update.mutate({
                  id: previous,
                  patch: { isReadLater: false },
                });
              }
            }}
          >
            <option value="">Not Configured</option>
            {available.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
                {channel.parentName ? ` — ${channel.parentName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className={page.channelList}>
          {channels.data.length
            ? channels.data.map((channel) => (
              <ChannelForm
                key={channel.id}
                channel={channel}
                pending={update.isPending}
                onDirty={() =>
                  setDirty((current) => new Set(current).add(channel.id))}
                onSave={(patch) => update.mutate({ id: channel.id, patch })}
              />
            ))
            : <InlineNotice>No imported text channels yet.</InlineNotice>}
        </div>
      </section>
      <UnsavedChanges when={dirty.size > 0 && !update.isPending} />
    </section>
  );
}

function ChannelForm(
  { channel, pending, onDirty, onSave }: {
    channel: DiscordChannel;
    pending: boolean;
    onDirty: () => void;
    onSave: (patch: Parameters<typeof api.updateChannel>[1]) => void;
  },
) {
  return (
    <form
      className={`${page.form} ${page.channelRow}`}
      onInput={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const description = data.get("routingDescription");
        onSave({
          routingDescription:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          isActiveForRouting: data.get("active") === "on",
        });
      }}
    >
      <div className={page.row}>
        <div className={page.truncate}>
          <strong>#{channel.name}</strong>
          <p className={page.muted}>{channel.parentName ?? "No Category"}</p>
        </div>
        <label className={page.switch}>
          <input
            type="checkbox"
            name="active"
            defaultChecked={channel.isActiveForRouting}
            disabled={channel.availability !== "available"}
          />{" "}
          Active for Routing
        </label>
      </div>
      <p className={page.muted}>{channel.discordTopic ?? "No Discord topic"}</p>
      <label>
        Routing Description<textarea
          name="routingDescription"
          defaultValue={channel.routingDescription ?? ""}
          placeholder="What belongs in this channel?…"
        />
      </label>
      <div className={page.row}>
        <span className={page.muted}>{channel.availability}</span>
        <button
          type="submit"
          className={`${page.button} ${page.compact}`}
          disabled={pending}
        >
          Save Routing
        </button>
      </div>
    </form>
  );
}
