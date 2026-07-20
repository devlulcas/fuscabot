import { extractPageMetadata } from "./metadata.ts";
import { api } from "./shared/api.ts";
import { createCapturePayload } from "./shared/capture.ts";
import { savePendingCapture } from "./shared/pending-capture.ts";
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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined || tab.windowId === undefined) return;
  const kind: CaptureKind = info.menuItemId === MENU.link
    ? "link"
    : info.menuItemId === MENU.selection
    ? "selection"
    : "page";
  const captureId = crypto.randomUUID();

  // Chrome only permits this call while the context-menu gesture is active.
  // Do not place any awaited work before it.
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch((cause) =>
    console.error("Could not open the capture panel", cause)
  );
  void captureFromContextMenu(info, tab, kind, captureId);
});

async function captureFromContextMenu(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab,
  kind: CaptureKind,
  captureId: string,
): Promise<void> {
  if (tab.id === undefined) return;
  await savePendingCapture({ captureId, state: "extracting" });
  await navigatePanel(tab, captureId);

  try {
    const [{ result: metadata }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageMetadata,
    });
    if (metadata === undefined) throw new Error("Could not read page metadata");
    await savePendingCapture({ captureId, state: "preparing" });
    await notifyCapture(captureId);
    const resource = await api.createCapture(createCapturePayload({
      captureId,
      kind,
      metadata,
      tabUrl: tab.url,
      tabTitle: tab.title,
      linkUrl: info.linkUrl,
      selectionText: info.selectionText,
    }));
    await savePendingCapture({
      captureId,
      resourceId: resource.id,
      state: "ready",
    });
  } catch (error) {
    await savePendingCapture({
      captureId,
      state: "failed",
      error: error instanceof Error ? error.message : "Capture failed",
      fallback: {
        url: info.linkUrl ?? tab.url,
        title: tab.title,
        selectedQuote: info.selectionText,
      },
    });
  }
  await notifyCapture(captureId);
}

async function navigatePanel(
  tab: chrome.tabs.Tab,
  captureId: string,
): Promise<void> {
  if (tab.id === undefined) return;
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: `side-panel/index.html#${capturePath(captureId)}`,
    enabled: true,
  });
  await chrome.runtime.sendMessage({
    type: "navigate-capture",
    captureId,
  }).catch(() => undefined);
}

async function notifyCapture(captureId: string): Promise<void> {
  await chrome.runtime.sendMessage({ type: "capture-updated", captureId })
    .catch(() => undefined);
}
