/// <reference path="../chrome.d.ts" />
import { DEFAULT_API_BASE_URL } from "./types.ts";

const CONFIG_KEY = "extensionConfig";
const LEGACY_API_BASE_URL = "https://api.fuscabot.dev";
export type ExtensionConfig = {
  apiBaseUrl: string;
  accessToken?: string;
  selectedGuildId?: string;
};

export async function getConfig(): Promise<ExtensionConfig> {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = stored[CONFIG_KEY];
  if (!isRecord(config)) return { apiBaseUrl: DEFAULT_API_BASE_URL };
  return {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    accessToken: typeof config.accessToken === "string"
      ? config.accessToken
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
    accessToken: typeof record.accessToken === "string"
      ? record.accessToken
      : undefined,
    selectedGuildId: typeof record.selectedGuildId === "string"
      ? record.selectedGuildId
      : undefined,
  };
  await chrome.storage.local.set({ [CONFIG_KEY]: value });
  return value;
}

export function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_API_BASE_URL;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
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
