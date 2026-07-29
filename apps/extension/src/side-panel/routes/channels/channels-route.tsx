import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import {
  channelsQueryOptions,
  guildsQueryOptions,
} from "./api/channels.queries.ts";
import { configQueryOptions } from "../settings/api/settings.queries.ts";
import { ChannelList } from "./components/channel-list.tsx";
import { GuildSyncForm } from "./components/guild-sync-form.tsx";
import { ReadLaterDestination } from "./components/read-later-destination.tsx";
import type { ChannelPatch } from "./model/channel-types.ts";
import { useChannelMutations } from "./api/channels.mutations.ts";
import { PageStack } from "../../components/layout/page-stack.tsx";
import { Card } from "../../components/layout/card.tsx";
import { Muted } from "../../components/typography/muted.tsx";
import css from "./channels-route.module.css";

export function ChannelsRoute() {
  const config = useQuery(configQueryOptions());
  const guilds = useQuery(guildsQueryOptions());
  const channels = useQuery(channelsQueryOptions());
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const markDirty = useCallback(
    (id: string) => setDirty((current) => new Set(current).add(id)),
    [],
  );
  const clearDirty = useCallback((id: string) =>
    setDirty((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    }), []);
  const mutations = useChannelMutations(clearDirty, setMessage);
  if (config.isPending || guilds.isPending || channels.isPending) {
    return <PageLoading label="Loading channels…" />;
  }
  if (guilds.isError || channels.isError) {
    return (
      <PageError
        error={guilds.error ?? channels.error}
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
    <PageStack className={css.settings}>
      <h1>Channels</h1>
      <Card className={css.settingsCard}>
        <div className={css.sectionHeading}>
          <div>
            <h2>Discord Channels</h2>
            <Muted>
              Choose a server, sync its channels, then configure routing.
            </Muted>
          </div>
        </div>
        <GuildSyncForm
          config={config.data}
          guilds={guilds.data}
          pending={mutations.sync.isPending}
          onSync={(guildId) => mutations.sync.mutate(guildId)}
        />
        {message ? <InlineNotice>{message}</InlineNotice> : null}
        {channels.isRefetchError
          ? (
            <InlineNotice error>
              Couldn’t refresh channels. Showing saved data.
            </InlineNotice>
          )
          : null}
        {mutations.sync.error || mutations.update.error
          ? (
            <InlineNotice error>
              {(mutations.sync.error ?? mutations.update.error)?.message}
            </InlineNotice>
          )
          : null}
        {!guilds.data.length
          ? (
            <InlineNotice>
              No manageable Discord servers were found for this account.
            </InlineNotice>
          )
          : null}
        <ReadLaterDestination
          value={readLater}
          channels={available}
          onChange={(next, previous) => {
            if (next) {
              mutations.update.mutate({
                id: next,
                patch: { isReadLater: true, isActiveForRouting: true },
              });
            } else if (previous) {
              mutations.update.mutate({
                id: previous,
                patch: { isReadLater: false },
              });
            }
          }}
        />
        <ChannelList
          channels={channels.data}
          pending={mutations.update.isPending}
          onDirty={markDirty}
          onSave={(id, patch: ChannelPatch) =>
            mutations.update.mutate({ id, patch })}
        />
      </Card>
      <UnsavedChanges when={dirty.size > 0 && !mutations.update.isPending} />
    </PageStack>
  );
}
