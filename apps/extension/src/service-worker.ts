// @ts-nocheck Chrome MV3 globals are intentionally dependency-free.
import { extractPageMetadata } from "./metadata.ts";
import { api } from "./shared/api.ts";
import { capturePath, cleanOptionalText } from "./shared/types.ts";

const MENU = {
  page: "capture-page",
  selection: "capture-selection",
  link: "capture-link",
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU.page,
    title: "Capture this page for Discord",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: MENU.selection,
    title: "Capture selected text for Discord",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: MENU.link,
    title: "Capture this link for Discord",
    contexts: ["link"],
  });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener((tab) => openPanel(tab, "/library"));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.windowId) return;
  const kind = info.menuItemId === MENU.link
    ? "link"
    : info.menuItemId === MENU.selection
    ? "selection"
    : "page";
  const captureId = crypto.randomUUID();
  await chrome.storage.local.set({
    pendingCapture: { captureId, state: "saving" },
  });
  await openPanel(tab, capturePath(captureId));
  try {
    const [{ result: metadata }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageMetadata,
    });
    const url = kind === "link" ? info.linkUrl : metadata.url ?? tab.url;
    const response = await api.createCapture({
      captureId,
      kind,
      url,
      title: metadata.title || tab.title,
      canonicalUrl: kind === "link" ? undefined : metadata.canonicalUrl,
      description: metadata.description,
      openGraph: metadata.openGraph,
      article: metadata.article,
      selectedText: cleanOptionalText(
        info.selectionText ?? metadata.selectedText,
        8_000,
      ),
      linkText: kind === "link"
        ? cleanOptionalText(info.selectionText, 500)
        : undefined,
    });
    await chrome.storage.local.set({
      pendingCapture: { captureId, resourceId: response.id, state: "saved" },
    });
  } catch (error) {
    await chrome.storage.local.set({
      pendingCapture: {
        captureId,
        state: "failed",
        error: error instanceof Error ? error.message : "Capture failed",
        fallback: {
          url: info.linkUrl ?? tab.url,
          title: tab.title,
          selectedText: info.selectionText,
        },
      },
    });
  }
  await chrome.runtime.sendMessage({ type: "capture-updated", captureId })
    .catch(() => undefined);
});

async function openPanel(tab, path) {
  if (!tab.id || !tab.windowId) return;
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: `side-panel/index.html#${path}`,
    enabled: true,
  });
  await chrome.sidePanel.open({ windowId: tab.windowId });
}
