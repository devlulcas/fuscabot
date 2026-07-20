import { api } from "../shared/api.ts";
import { getConfig, saveConfig } from "../shared/config.ts";
import type { ApiResource, CapturePayload } from "../shared/types.ts";
import { parseRoute } from "./router.ts";

const app = requiredElement<HTMLElement>(document, "#app");
globalThis.addEventListener("hashchange", () => void render());
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "capture-updated") void render();
});
void render();

async function render(): Promise<void> {
  const route = parseRoute(location.hash);
  document.querySelectorAll("nav a").forEach((link) =>
    link.getAttribute("href")?.includes(route.name)
      ? link.setAttribute("aria-current", "page")
      : link.removeAttribute("aria-current")
  );
  app.replaceChildren();
  try {
    if (route.name === "capture") await renderCapture(route.captureId);
    else if (route.name === "settings") await renderSettings();
    else await renderLibrary();
    app.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  } catch (error) {
    showError(error);
  }
}

type CaptureFallback = { url?: string; title?: string; selectedQuote?: string };
type PendingCapture = {
  captureId?: string;
  resourceId?: string;
  state?: "saving" | "saved" | "failed";
  error?: string;
  fallback?: CaptureFallback;
};

async function renderCapture(captureId?: string): Promise<void> {
  app.innerHTML =
    `<section class="stack"><h1>Capture</h1><div class="skeleton"></div><p>Saving your link before preparing it…</p></section>`;
  const stored = await chrome.storage.local.get("pendingCapture");
  const pending = asPendingCapture(stored.pendingCapture);
  if (!captureId) return renderManual({});
  if (pending?.captureId === captureId && pending.state === "failed") {
    return renderManual(pending.fallback ?? {}, pending.error);
  }
  const resourceId = pending?.captureId === captureId && pending.resourceId
    ? pending.resourceId
    : captureId;
  const resource = await api.getResource(resourceId);
  renderEditor(resource);
  if (resource.enrichmentStatus === "preparing") {
    setTimeout(() => {
      const current = parseRoute(location.hash);
      if (current.name === "capture" && current.captureId === captureId) {
        void render();
      }
    }, 1_500);
  }
}

function renderManual(fallback: CaptureFallback, error?: string): void {
  app.innerHTML = `<section class="stack"><h1>Capture manually</h1>${
    error
      ? `<p class="notice error">${
        escapeHtml(error)
      }. Retry saving it below.</p>`
      : ""
  }<form class="stack"><label>URL<input name="url" type="url" required value="${
    escapeHtml(fallback.url)
  }"></label><label>Title<input name="title" required value="${
    escapeHtml(fallback.title)
  }"></label><label>Selected quote<textarea name="selectedQuote">${
    escapeHtml(fallback.selectedQuote)
  }</textarea></label><button class="primary">Save to Inbox</button></form></section>`;
  const form = requiredElement<HTMLFormElement>(app, "form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const captureId = crypto.randomUUID();
    const payload: CapturePayload = {
      captureId,
      url: formValue(form, "url"),
      title: formValue(form, "title"),
      selectedQuote: optionalFormValue(form, "selectedQuote"),
      linkText: null,
      outputLanguage: "pt-BR",
      metadata: {
        canonicalUrl: null,
        description: null,
        siteName: null,
        author: null,
        publishedAt: null,
        imageUrl: null,
        sourceLanguage: null,
      },
    };
    const resource = await api.createCapture(payload);
    await chrome.storage.local.set({
      pendingCapture: { captureId, resourceId: resource.id, state: "saved" },
    });
    location.hash = `#/capture/${captureId}`;
  });
}

function renderEditor(resource: ApiResource): void {
  app.innerHTML =
    `<section class="stack"><h1 tabindex="-1">Capture</h1><article class="card"><strong>${
      escapeHtml(resource.title)
    }</strong><p class="muted">${escapeHtml(resource.originalUrl)}</p>${
      resource.selectedQuote
        ? `<blockquote>“${escapeHtml(resource.selectedQuote)}”</blockquote>`
        : ""
    }</article>${
      resource.enrichmentStatus === "failed"
        ? '<p class="notice error" role="alert">AI preparation failed. You can still edit manually. <button type="button" data-retry-ai>Retry AI</button></p>'
        : resource.enrichmentStatus === "preparing"
        ? '<p class="notice" role="status">AI preparation is still running. This view updates automatically.</p>'
        : '<p class="notice" role="status">AI preparation is ready. Review everything before publishing.</p>'
    }<form class="stack"><label>Summary<textarea name="summary">${
      escapeHtml(resource.summary)
    }</textarea></label><label>Why it is useful<textarea name="whyUseful">${
      escapeHtml(resource.whyUseful)
    }</textarea></label><label>Your note<textarea name="personalNote">${
      escapeHtml(resource.personalNote)
    }</textarea></label><label>Destination<select name="channelId"><option value="">Choose a channel</option>${
      (resource.channels ?? []).map((channel) =>
        `<option value="${escapeHtml(channel.id)}">#${
          escapeHtml(channel.name)
        }</option>`
      ).join("")
    }</select></label><div class="actions"><button type="button" data-read-later>Save to Read Later</button><button class="primary" data-publish disabled>Publish to selected channel</button></div></form></section>`;
  const form = requiredElement<HTMLFormElement>(app, "form");
  app.querySelector<HTMLButtonElement>("[data-retry-ai]")?.addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      button.textContent = "Retrying…";
      await api.retryEnrichment(resource.id);
      await render();
    },
  );
  const select = requiredElement<HTMLSelectElement>(form, '[name="channelId"]');
  const publish = requiredElement<HTMLButtonElement>(form, "[data-publish]");
  const sync = (): void => {
    publish.disabled = !select.value;
  };
  select.addEventListener("change", sync);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const channelId = select.value;
    if (!channelId) return;
    publish.disabled = true;
    await api.updateResource(resource.id, {
      summary: optionalFormValue(form, "summary"),
      whyUseful: optionalFormValue(form, "whyUseful"),
      personalNote: optionalFormValue(form, "personalNote"),
    });
    try {
      showSuccess(await api.publish(resource.id, channelId));
    } finally {
      publish.disabled = false;
    }
  });
  requiredElement<HTMLButtonElement>(form, "[data-read-later]")
    .addEventListener(
      "click",
      async (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        button.disabled = true;
        try {
          await api.updateResource(resource.id, {
            summary: optionalFormValue(form, "summary"),
            whyUseful: optionalFormValue(form, "whyUseful"),
            personalNote: optionalFormValue(form, "personalNote"),
          });
          showSuccess(await api.readLater(resource.id));
        } catch (cause) {
          showError(cause);
        } finally {
          button.disabled = false;
        }
      },
    );
}

async function renderLibrary(): Promise<void> {
  app.innerHTML =
    `<section class="stack"><h1 tabindex="-1">Library</h1><form role="search"><label>Search<input name="q" type="search" placeholder="Title, URL, note, tag…"></label></form><div data-results><div class="skeleton" role="status" aria-label="Loading resources"></div></div></section>`;
  const form = requiredElement<HTMLFormElement>(app, "form");
  const results = requiredElement<HTMLElement>(app, "[data-results]");
  const load = async (): Promise<void> => {
    const items = await api.listResources(formValue(form, "q"));
    results.innerHTML = items.length
      ? items.map((resource) =>
        `<article class="card resource"><strong>${
          escapeHtml(resource.title)
        }</strong><span class="muted">${
          escapeHtml(resource.originalUrl)
        }</span><a href="${
          escapeHtml(resource.originalUrl)
        }" target="_blank" rel="noopener noreferrer">Open source</a><a href="#/capture/${
          escapeHtml(resource.id)
        }">Review</a></article>`
      ).join("")
      : '<p class="notice">No resources found. Capture a page to start your library.</p>';
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void load().catch(showError);
  });
  await load();
}

async function renderSettings(): Promise<void> {
  const config = await getConfig();
  let connected = false;
  let guilds: Array<{ id: string; name: string }> = [];
  if (config.accessToken) {
    try {
      await api.session();
      guilds = await api.guilds();
      connected = true;
    } catch {
      connected = false;
    }
  }
  app.innerHTML =
    `<section class="stack"><h1 tabindex="-1">Settings</h1><form class="card stack"><label>API base URL<input name="apiBaseUrl" type="url" required value="${
      escapeHtml(config.apiBaseUrl)
    }"></label><button class="primary">Save API URL</button></form><section class="card stack"><h2>Discord</h2><p class="notice">${
      connected ? "Connected as the configured owner." : "Not connected."
    }</p>${
      connected && guilds.length
        ? `<label>Server<select data-guild>${
          guilds.map((guild) =>
            `<option value="${escapeHtml(guild.id)}" ${
              guild.id === config.selectedGuildId ? "selected" : ""
            }>${escapeHtml(guild.name)}</option>`
          ).join("")
        }</select></label>`
        : ""
    }<div class="actions"><button data-connect>${
      connected ? "Reconnect Discord" : "Connect Discord"
    }</button><button data-sync ${
      connected && guilds.length ? "" : "disabled"
    }>Sync channels now</button></div><div data-channels></div></section></section>`;
  const form = requiredElement<HTMLFormElement>(app, "form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveConfig({ ...config, apiBaseUrl: formValue(form, "apiBaseUrl") });
    requiredElement<HTMLButtonElement>(form, "button").textContent = "Saved";
  });
  requiredElement<HTMLButtonElement>(app, "[data-connect]").addEventListener(
    "click",
    () => void connectDiscord(config).catch(showError),
  );
  const sync = requiredElement<HTMLButtonElement>(app, "[data-sync]");
  sync.addEventListener("click", async () => {
    sync.disabled = true;
    try {
      const select = app.querySelector<HTMLSelectElement>("[data-guild]");
      if (!select?.value) throw new Error("Choose a Discord server");
      const channels = await api.syncChannels(select.value);
      await saveConfig({ ...config, selectedGuildId: select.value });
      sync.textContent = `Synced ${channels.length}`;
      requiredElement<HTMLElement>(app, "[data-channels]").innerHTML =
        channels.length
          ? `<p class="muted">${
            channels.map((channel) => `#${escapeHtml(channel.name)}`).join(
              " · ",
            )
          }</p>`
          : '<p class="notice">No accessible standard text channels found.</p>';
    } finally {
      sync.disabled = false;
    }
  });
}

async function connectDiscord(
  config: Awaited<ReturnType<typeof getConfig>>,
): Promise<void> {
  const extensionRedirect = chrome.identity.getRedirectURL("discord");
  const url = new URL("/v1/auth/discord/start", config.apiBaseUrl);
  url.searchParams.set("extension_redirect", extensionRedirect);
  const result = await chrome.identity.launchWebAuthFlow({
    url: url.href,
    interactive: true,
  });
  if (!result) throw new Error("Discord connection was cancelled");
  const accessToken = new URLSearchParams(new URL(result).hash.slice(1)).get(
    "access_token",
  );
  if (!accessToken) {
    throw new Error("Discord connection did not return a session");
  }
  await saveConfig({ ...config, accessToken });
  await renderSettings();
}

function showSuccess(delivery: { discordUrl?: string }): void {
  app.insertAdjacentHTML(
    "afterbegin",
    `<p class="notice">Published successfully.${
      delivery.discordUrl
        ? ` <a href="${
          escapeHtml(delivery.discordUrl)
        }" target="_blank" rel="noopener noreferrer">Open in Discord</a>`
        : ""
    }</p>`,
  );
}

function showError(error: unknown): void {
  app.innerHTML =
    `<section class="notice error" role="alert"><h1 tabindex="-1">Something went wrong</h1><p>${
      escapeHtml(error instanceof Error ? error.message : "Unknown error")
    }</p></section>`;
}

function escapeHtml(value: unknown = ""): string {
  const span = document.createElement("span");
  span.textContent = String(value ?? "");
  return span.innerHTML;
}

function requiredElement<T extends Element>(
  parent: ParentNode,
  selector: string,
): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

function formValue(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

function optionalFormValue(form: HTMLFormElement, name: string): string | null {
  return formValue(form, name).trim() || null;
}

function asPendingCapture(value: unknown): PendingCapture | undefined {
  return typeof value === "object" && value !== null
    ? value as PendingCapture
    : undefined;
}
