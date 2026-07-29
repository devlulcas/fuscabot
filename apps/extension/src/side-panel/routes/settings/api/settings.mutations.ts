import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../../shared/api.ts";
import { getConfig, saveConfig } from "../../../../shared/config.ts";
import { applyAppearance } from "../model/appearance.ts";
import { settingsQueryKeys } from "./settings.queries.ts";
import { resetCacheIdentity } from "../../../platform/cache-identity.ts";

export function saveAppearanceMutationOptions(
  queryClient: QueryClient,
  setMessage: (message: string) => void,
) {
  return mutationOptions({
    mutationFn: saveConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsQueryKeys.config, updated);
      applyAppearance(updated);
      setMessage("Appearance saved.");
    },
  });
}

export function saveApiMutationOptions(
  queryClient: QueryClient,
  setDirty: (dirty: boolean) => void,
  setMessage: (message: string) => void,
) {
  return mutationOptions({
    mutationFn: async (base: string) => {
      const previous = await getConfig();
      const updated = await saveConfig({ ...previous, apiBaseUrl: base });
      if (updated.apiBaseUrl !== previous.apiBaseUrl) {
        await resetCacheIdentity(queryClient);
        globalThis.location.reload();
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsQueryKeys.config, updated);
      setDirty(false);
      setMessage("API URL saved.");
    },
  });
}

export function connectMutationOptions(
  queryClient: QueryClient,
  navigate: ReturnType<typeof useNavigate>,
  returnTo: string | undefined,
) {
  return mutationOptions({
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
      await resetCacheIdentity(queryClient);
    },
    onSuccess: () => {
      if (returnTo) navigate(returnTo, { replace: true });
      globalThis.location.reload();
    },
  });
}

export function logoutMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
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
      await resetCacheIdentity(queryClient);
    },
    onSuccess: () => globalThis.location.reload(),
  });
}

export function useSettingsMutations(
  setDirty: (dirty: boolean) => void,
  setMessage: (message: string) => void,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  return {
    saveAppearance: useMutation(
      saveAppearanceMutationOptions(queryClient, setMessage),
    ),
    saveApi: useMutation(
      saveApiMutationOptions(queryClient, setDirty, setMessage),
    ),
    connect: useMutation(
      connectMutationOptions(queryClient, navigate, returnTo),
    ),
    logout: useMutation(logoutMutationOptions(queryClient)),
  };
}
