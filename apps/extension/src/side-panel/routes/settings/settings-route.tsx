import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { applyAppearance } from "./model/appearance.ts";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import {
  configQueryOptions,
  sessionQueryOptions,
  settingsQueryKeys,
} from "./api/settings.queries.ts";
import { AppearanceSettings } from "./components/appearance-settings.tsx";
import { ApiSettings } from "./components/api-settings.tsx";
import { DiscordAccountSettings } from "./components/discord-account-settings.tsx";
import { useSettingsMutations } from "./api/settings.mutations.ts";
import { PageStack } from "../../components/layout/page-stack.tsx";
import css from "./settings-route.module.css";

export function SettingsRoute() {
  const queryClient = useQueryClient();
  const config = useQuery(configQueryOptions());
  const session = useQuery({
    ...sessionQueryOptions(),
    enabled: Boolean(config.data?.accessToken),
    retry: false,
  });
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const actions = useSettingsMutations(setDirty, setMessage);
  if (config.isPending) return <PageLoading label="Loading settings…" />;
  if (config.isError) {
    return (
      <PageError
        error={config.error}
        retry={() => void config.refetch()}
      />
    );
  }
  const current = config.data;
  const updateAppearance = (next: typeof current) => {
    applyAppearance(next);
    queryClient.setQueryData(settingsQueryKeys.config, next);
  };
  return (
    <PageStack className={css.settings}>
      <h1>Settings</h1>
      <AppearanceSettings
        config={current}
        onThemeChange={(theme) => {
          const next = { ...current, theme };
          updateAppearance(next);
          actions.saveAppearance.mutate(next);
        }}
        onAccentChange={(accentColor) =>
          updateAppearance({ ...current, accentColor })}
        onAccentBlur={(accentColor) =>
          actions.saveAppearance.mutate({ ...current, accentColor })}
        onResetAccent={() =>
          actions.saveAppearance.mutate({ ...current, accentColor: undefined })}
      />
      <ApiSettings
        apiBaseUrl={current.apiBaseUrl}
        saving={actions.saveApi.isPending}
        onDirty={() => setDirty(true)}
        onSave={(base) => actions.saveApi.mutate(base)}
      />
      <DiscordAccountSettings
        session={session}
        connecting={actions.connect.isPending}
        signingOut={actions.logout.isPending}
        onConnect={() => actions.connect.mutate()}
        onLogout={() => actions.logout.mutate()}
      />
      {message ? <InlineNotice>{message}</InlineNotice> : null}
      {actions.saveAppearance.error || actions.saveApi.error ||
          actions.connect.error || actions.logout.error
        ? (
          <InlineNotice error>
            {(actions.saveAppearance.error ?? actions.saveApi.error ??
              actions.connect.error ?? actions.logout.error)?.message}
          </InlineNotice>
        )
        : null}
      <UnsavedChanges when={dirty && !actions.saveApi.isPending} />
    </PageStack>
  );
}
