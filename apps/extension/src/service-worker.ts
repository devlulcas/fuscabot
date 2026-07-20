import { extractPageMetadata } from "./metadata.ts";
import { api } from "./shared/api.ts";
import { createCapturePayload } from "./shared/capture.ts";
import { type CaptureKind, capturePath } from "./shared/types.ts";

const MENU = {
  page: "capture-page",
  selection: "capture-selection",
  link: "capture-link",
} as const;

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
  if (tab?.id === undefined || tab.windowId === undefined) return;
  const kind: CaptureKind = info.menuItemId === MENU.link
    ? "link"
    : info.menuItemId === MENU.selection
    ? "selection"
    : "page";
  const captureId = crypto.randomUUID();
  await chrome.storage.local.set({
    pendingCapture: { captureId, state: "saving" },
  });

  try {
    const [{ result: metadata }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageMetadata,
    });
    if (metadata === undefined) throw new Error("Could not read page metadata");
    const resource = await api.createCapture(createCapturePayload({
      captureId,
      kind,
      metadata,
      tabUrl: tab.url,
      tabTitle: tab.title,
      linkUrl: info.linkUrl,
      selectionText: info.selectionText,
    }));
    await chrome.storage.local.set({
      pendingCapture: { captureId, resourceId: resource.id, state: "saved" },
    });
    await openPanel(tab, capturePath(captureId));
  } catch (error) {
    await chrome.storage.local.set({
      pendingCapture: {
        captureId,
        state: "failed",
        error: error instanceof Error ? error.message : "Capture failed",
        fallback: {
          url: info.linkUrl ?? tab.url,
          title: tab.title,
          selectedQuote: info.selectionText,
        },
      },
    });
    await openPanel(tab, capturePath(captureId));
  }
  await chrome.runtime.sendMessage({ type: "capture-updated", captureId })
    .catch(() => undefined);
});

async function openPanel(tab: chrome.tabs.Tab, path: string): Promise<void> {
  if (tab.id === undefined || tab.windowId === undefined) return;
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: `side-panel/index.html#${path}`,
    enabled: true,
  });
  await chrome.sidePanel.open({ windowId: tab.windowId });
}
