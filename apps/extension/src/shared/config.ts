/// <reference path="../chrome.d.ts" />
import { DEFAULT_API_BASE_URL } from "./types.ts";

const CONFIG_KEY = "extensionConfig";
const LEGACY_API_BASE_URL = "https://api.fuscabot.dev";
export const UI_THEMES = ["dark", "light", "adwaita"] as const;
export type UiTheme = typeof UI_THEMES[number];
export type ExtensionConfig = {
  apiBaseUrl: string;
  theme: UiTheme;
  accentColor?: string;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  selectedGuildId?: string;
};

export async function getConfig(): Promise<ExtensionConfig> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = stored[CONFIG_KEY];
  if (!isRecord(config)) {
    return { apiBaseUrl: DEFAULT_API_BASE_URL, theme: "dark" };
  }
  return {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    theme: normalizeTheme(config.theme),
    accentColor: normalizeAccentColor(config.accentColor),
    accessToken: typeof config.accessToken === "string"
      ? config.accessToken
      : undefined,
    refreshToken: typeof config.refreshToken === "string"
      ? config.refreshToken
      : undefined,
    sessionId: typeof config.sessionId === "string"
      ? config.sessionId
      : undefined,
    selectedGuildId: typeof config.selectedGuildId === "string"
      ? config.selectedGuildId
      : undefined,
  };
}

export async function saveConfig(config: unknown): Promise<ExtensionConfig> {
  const record = isRecord(config) ? config : {};
  const value = {
    apiBaseUrl: normalizeBaseUrl(record.apiBaseUrl),
    theme: normalizeTheme(record.theme),
    accentColor: normalizeAccentColor(record.accentColor),
    accessToken: typeof record.accessToken === "string"
      ? record.accessToken
      : undefined,
    refreshToken: typeof record.refreshToken === "string"
      ? record.refreshToken
      : undefined,
    sessionId: typeof record.sessionId === "string"
      ? record.sessionId
      : undefined,
    selectedGuildId: typeof record.selectedGuildId === "string"
      ? record.selectedGuildId
      : undefined,
  };
  await chrome.storage.local.set({ [CONFIG_KEY]: value });
  return value;
}

export function normalizeTheme(value: unknown): UiTheme {
  return UI_THEMES.find((theme) => theme === value) ?? "dark";
}

export function normalizeAccentColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

export function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_API_BASE_URL;
  try {
    const url = new URL(value.trim());
    const localHost = url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) ||
      url.username !== "" || url.password !== "" || url.search !== "" ||
      url.hash !== "" ||
      (url.pathname !== "" && url.pathname !== "/")
    ) {
      return DEFAULT_API_BASE_URL;
    }
    const normalized = url.href.replace(/\/$/, "");
    return normalized === LEGACY_API_BASE_URL
      ? DEFAULT_API_BASE_URL
      : normalized;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
