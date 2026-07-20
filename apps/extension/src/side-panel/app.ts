// @ts-nocheck DOM nodes are constrained by the static side-panel document.
import { api } from "../shared/api.ts";
import { getConfig, saveConfig } from "../shared/config.ts";
import { parseRoute } from "./router.ts";

const app = document.querySelector("#app");
globalThis.addEventListener("hashchange", render);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "capture-updated") render();
});
render();

async function render() {
  const route = parseRoute(location.hash);
  document.querySelectorAll("nav a").forEach((link) =>
    link.toggleAttribute(
      "aria-current",
      link.getAttribute("href")?.includes(route.name),
    )
  );
  app.replaceChildren();
  try {
    if (route.name === "capture") await renderCapture(route.captureId);
    else if (route.name === "settings") await renderSettings();
    else await renderLibrary();
  } catch (error) {
    showError(error);
  }
}

async function renderCapture(captureId) {
  app.innerHTML =
    `<section class="stack"><h1>Capture</h1><div class="skeleton"></div><p>Saving your link before preparing it…</p></section>`;
  const stored = await chrome.storage.local.get("pendingCapture");
  /** @type {any} */
  const pendingCapture = stored.pendingCapture;
  if (!captureId || pendingCapture?.captureId !== captureId) {
    return renderManual({});
  }
  if (pendingCapture.state === "failed") {
    return renderManual(pendingCapture.fallback, pendingCapture.error);
  }
  if (!pendingCapture.resourceId) return;
  const resource = await api.getResource(pendingCapture.resourceId);
  renderEditor(resource);
}

function renderManual(fallback, error = undefined) {
  app.innerHTML = `<section class="stack"><h1>Capture manually</h1>${
    error
      ? `<p class="notice error">${
        escapeHtml(error)
      }. Your link is still here; retry saving it below.</p>`
      : ""
  }<form class="stack"><label>URL<input name="url" type="url" required value="${
    escapeHtml(fallback?.url ?? "")
  }"></label><label>Title<input name="title" value="${
    escapeHtml(fallback?.title ?? "")
  }"></label><label>Selected quote<textarea name="selectedText">${
    escapeHtml(fallback?.selectedText ?? "")
  }</textarea></label><button class="primary">Save to Inbox</button></form></section>`;
  app.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api.createCapture({
      ...data,
      kind: "page",
      captureId: crypto.randomUUID(),
    });
    const nextCaptureId = result.captureId ?? result.id;
    await chrome.storage.local.set({
      pendingCapture: {
        captureId: nextCaptureId,
        resourceId: result.id,
        state: "saved",
      },
    });
    location.hash = `#/capture/${nextCaptureId}`;
  });
}

function renderEditor(resource) {
  const enrichment = resource.enrichment ?? {};
  app.innerHTML =
    `<section class="stack"><h1>Capture</h1><article class="card"><strong>${
      escapeHtml(resource.title ?? "Untitled")
    }</strong><p class="muted">${escapeHtml(resource.url)}</p>${
      resource.selectedText
        ? `<blockquote>“${escapeHtml(resource.selectedText)}”</blockquote>`
        : ""
    }</article>${
      enrichment.status === "failed"
        ? '<p class="notice error">AI preparation failed. You can still edit and publish manually.</p>'
        : ""
    }<form class="stack"><label>Summary<textarea name="summary">${
      escapeHtml(enrichment.summary ?? resource.summary ?? "")
    }</textarea></label><label>Why it is useful<textarea name="usefulness">${
      escapeHtml(enrichment.usefulness ?? resource.usefulness ?? "")
    }</textarea></label><label>Your note (optional)<textarea name="note">${
      escapeHtml(resource.note ?? "")
    }</textarea></label><label>Destination<select name="channelId"><option value="">Choose a channel</option>${
      (resource.channels ?? []).map((c) =>
        `<option value="${escapeHtml(c.id)}" ${
          c.id === enrichment.suggestedChannelId &&
            enrichment.confidence === "high"
            ? "selected"
            : ""
        }>#${escapeHtml(c.name)}</option>`
      ).join("")
    }</select></label><small class="muted">${
      escapeHtml(
        enrichment.rationale ??
          "Suggestions are editable and nothing is published automatically.",
      )
    }</small><div class="actions"><button type="button" data-read-later>Save to Read Later</button><button class="primary" data-publish disabled>Publish to selected channel</button></div></form></section>`;
  const form = app.querySelector("form");
  const select = form.elements.channelId;
  const publish = form.querySelector("[data-publish]");
  const sync = () => publish.disabled = !select.value;
  sync();
  select.addEventListener("change", sync);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    await api.updateResource(resource.id, fields);
    const delivery = await api.publish(resource.id, fields.channelId);
    showSuccess(delivery);
  });
  form.querySelector("[data-read-later]").addEventListener(
    "click",
    async () => showSuccess(await api.readLater(resource.id)),
  );
}

async function renderLibrary() {
  app.innerHTML =
    `<section class="stack"><h1>Library</h1><form role="search"><label>Search<input name="q" type="search" placeholder="Title, URL, note, tag…"></label></form><div data-results><div class="skeleton"></div></div></section>`;
  const form = app.querySelector("form");
  const results = app.querySelector("[data-results]");
  const load = async () => {
    const value = form.elements.q.value;
    const data = await api.listResources(value);
    const items = data.items ?? data;
    results.innerHTML = items.length
      ? items.map((r) =>
        `<article class="card resource"><strong>${
          escapeHtml(r.title ?? "Untitled")
        }</strong><span class="muted">${
          escapeHtml(r.url)
        }</span><a href="#/capture/${
          escapeHtml(r.captureId ?? r.id)
        }">Review</a></article>`
      ).join("")
      : '<p class="notice">No resources found. Capture a page to start your library.</p>';
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    load().catch(showError);
  });
  await load();
}

async function renderSettings() {
  const config = await getConfig();
  app.innerHTML =
    `<section class="stack"><h1>Settings</h1><form class="card stack"><label>API base URL<input name="apiBaseUrl" type="url" required value="${
      escapeHtml(config.apiBaseUrl)
    }"></label><label>Session token<input name="accessToken" type="password" value="${
      escapeHtml(config.accessToken ?? "")
    }" autocomplete="off"></label><button class="primary">Save connection</button></form><section class="card"><h2>Discord</h2><p class="muted">Connect your account through the configured backend, then sync accessible text channels.</p><div class="actions"><button data-connect>Connect Discord</button><button data-sync>Sync channels now</button></div></section></section>`;
  app.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveConfig(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.querySelector("button").textContent = "Saved";
  });
  app.querySelector("[data-connect]").addEventListener(
    "click",
    () => open(`${config.apiBaseUrl}/v1/auth/discord/start`, "_blank"),
  );
  app.querySelector("[data-sync]").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await api.syncChannels();
      event.currentTarget.textContent = "Synced";
    } finally {
      event.currentTarget.disabled = false;
    }
  });
}

function showSuccess(delivery) {
  app.insertAdjacentHTML(
    "afterbegin",
    `<p class="notice">Published successfully.${
      delivery?.discordUrl
        ? ` <a href="${
          escapeHtml(delivery.discordUrl)
        }" target="_blank">Open in Discord</a>`
        : ""
    }</p>`,
  );
}
function showError(error) {
  app.innerHTML =
    `<section class="notice error"><h1>Something went wrong</h1><p>${
      escapeHtml(error instanceof Error ? error.message : "Unknown error")
    }</p></section>`;
}
function escapeHtml(value = "") {
  const span = document.createElement("span");
  span.textContent = String(value);
  return span.innerHTML;
}
