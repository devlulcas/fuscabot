import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../shared/api.ts";
import {
  getConfig,
  saveConfig,
  UI_THEMES,
  type UiTheme,
} from "../../../shared/config.ts";
import { applyAppearance, effectiveAccent } from "../../app/appearance.ts";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import page from "../../components/layout/page.module.css";
import { configQuery, sessionQuery } from "../../data/queries.ts";
import { queryKeys } from "../../data/query-keys.ts";
import { resetCacheIdentity } from "../../platform/cache-identity.ts";

export function SettingsRoute() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const config = useQuery(configQuery());
  const session = useQuery({
    ...sessionQuery(),
    enabled: Boolean(config.data?.accessToken),
    retry: false,
  });
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const saveAppearance = useMutation({
    mutationFn: saveConfig,
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.config, updated);
      applyAppearance(updated);
      setMessage("Appearance saved.");
    },
  });
  const saveApi = useMutation({
    mutationFn: async (base: string) => {
      const previous = await getConfig();
      const updated = await saveConfig({ ...previous, apiBaseUrl: base });
      if (updated.apiBaseUrl !== previous.apiBaseUrl) {
        await resetCacheIdentity(client);
        globalThis.location.reload();
      }
      return updated;
    },
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.config, updated);
      setDirty(false);
      setMessage("API URL saved.");
    },
  });
  const connect = useMutation({
    mutationFn: async () => {
      const current = await getConfig();
      const redirect = chrome.identity.getRedirectURL("discord");
      const url = new URL("/v1/auth/discord/start", current.apiBaseUrl);
      url.searchParams.set("extension_redirect", redirect);
      const result = await chrome.identity.launchWebAuthFlow({
        url: url.href,
        interactive: true,
      });
      if (!result) throw new Error("Discord connection was cancelled");
      const handoff = new URLSearchParams(new URL(result).hash.slice(1));
      const accessToken = handoff.get("access_token");
      const refreshToken = handoff.get("refresh_token");
      const sessionId = handoff.get("session_id");
      if (!accessToken || !refreshToken || !sessionId) {
        throw new Error("Discord connection did not return a session");
      }
      await saveConfig({ ...current, accessToken, refreshToken, sessionId });
      await resetCacheIdentity(client);
    },
    onSuccess: () => {
      const returnTo = (location.state as { returnTo?: string } | null)
        ?.returnTo;
      if (returnTo) navigate(returnTo, { replace: true });
      globalThis.location.reload();
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      await api.logout();
      const current = await getConfig();
      await saveConfig({
        ...current,
        accessToken: undefined,
        refreshToken: undefined,
        sessionId: undefined,
        selectedGuildId: undefined,
      });
      await resetCacheIdentity(client);
    },
    onSuccess: () => globalThis.location.reload(),
  });
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
  return (
    <section className={`${page.stack} ${page.settings}`}>
      <h1>Settings</h1>
      <section className={`${page.card} ${page.settingsCard}`}>
        <h2>Appearance</h2>
        <form className={page.form}>
          <label>
            Theme<select
              value={current.theme}
              onChange={(event) => {
                const next = {
                  ...current,
                  theme: event.target.value as UiTheme,
                };
                applyAppearance(next);
                saveAppearance.mutate(next);
              }}
            >
              {UI_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme === "botanical-dark"
                    ? "Botanical Dark"
                    : titleCase(theme)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Accent Color<input
              name="accentColor"
              type="color"
              value={effectiveAccent(current)}
              onChange={(event) => {
                const next = { ...current, accentColor: event.target.value };
                applyAppearance(next);
                client.setQueryData(queryKeys.config, next);
              }}
              onBlur={(event) =>
                saveAppearance.mutate({
                  ...current,
                  accentColor: event.target.value,
                })}
            />
          </label>
          <button
            type="button"
            className={`${page.button} ${page.ghost}`}
            onClick={() =>
              saveAppearance.mutate({ ...current, accentColor: undefined })}
          >
            Use Theme Default
          </button>
        </form>
      </section>
      <section className={`${page.card} ${page.settingsCard}`}>
        <form
          className={page.form}
          onInput={() => setDirty(true)}
          onSubmit={(event) => {
            event.preventDefault();
            const base = new FormData(event.currentTarget).get("apiBaseUrl");
            if (typeof base === "string") saveApi.mutate(base);
          }}
        >
          <h2>API</h2>
          <label>
            API Base URL<input
              name="apiBaseUrl"
              type="url"
              required
              autoComplete="off"
              defaultValue={current.apiBaseUrl}
            />
          </label>
          <button
            type="submit"
            className={`${page.button} ${page.primary}`}
            disabled={saveApi.isPending}
          >
            Save API URL
          </button>
        </form>
      </section>
      <section className={`${page.card} ${page.settingsCard}`}>
        <h2>Discord Account</h2>
        {session.isError
          ? (
            <InlineNotice error>
              Couldn’t verify the connection. Your saved session was kept.
            </InlineNotice>
          )
          : (
            <InlineNotice>
              {session.isPending
                ? "Checking connection…"
                : session.data
                ? "Connected as the configured owner."
                : "Not connected."}
            </InlineNotice>
          )}
        <div className={page.actions}>
          <button
            type="button"
            className={page.button}
            disabled={connect.isPending || logout.isPending}
            onClick={() => connect.mutate()}
          >
            {connect.isPending
              ? "Connecting…"
              : session.data
              ? "Reconnect Discord"
              : "Connect Discord"}
          </button>
          {session.data
            ? (
              <button
                type="button"
                className={`${page.button} ${page.danger}`}
                disabled={connect.isPending || logout.isPending}
                onClick={() => logout.mutate()}
              >
                {logout.isPending ? "Signing Out…" : "Sign Out"}
              </button>
            )
            : null}
        </div>
      </section>
      {message ? <InlineNotice>{message}</InlineNotice> : null}
      {saveAppearance.error || saveApi.error || connect.error || logout.error
        ? (
          <InlineNotice error>
            {(saveAppearance.error ?? saveApi.error ?? connect.error ??
              logout.error)?.message}
          </InlineNotice>
        )
        : null}
      <UnsavedChanges when={dirty && !saveApi.isPending} />
    </section>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
