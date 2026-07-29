/// <reference path="../chrome.d.ts" />
const CONFIG_KEY = "extensionConfig";
export const UI_THEMES = ["system", "botanical", "botanical-dark"] as const;
export type UiTheme = typeof UI_THEMES[number];
export type ExtensionConfig = {
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
    return { theme: "botanical" };
  }
  return {
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
  if (value === "light" || value === "adwaita") return "botanical";
  if (value === "dark" || value === "adwaita-dark") return "botanical-dark";
  return UI_THEMES.find((theme) => theme === value) ?? "botanical";
}

export function normalizeAccentColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
