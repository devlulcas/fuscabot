// @ts-nocheck Chrome storage values are validated before use.
import { DEFAULT_API_BASE_URL } from "./types.ts";

const CONFIG_KEY = "extensionConfig";

export async function getConfig() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  /** @type {any} */
  const config = stored[CONFIG_KEY];
  if (!config || typeof config !== "object") {
    return { apiBaseUrl: DEFAULT_API_BASE_URL };
  }
  return {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    accessToken: config.accessToken,
  };
}

export async function saveConfig(config) {
  const value = {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    accessToken: config.accessToken,
  };
  await chrome.storage.local.set({ [CONFIG_KEY]: value });
  return value;
}

export function normalizeBaseUrl(value) {
  const fallback = DEFAULT_API_BASE_URL;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.href.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}
