import { api, type DiscordChannel } from "../shared/api.ts";
import { getConfig, saveConfig } from "../shared/config.ts";
import { getPendingCapture } from "../shared/pending-capture.ts";
import type { ApiResource, CapturePayload } from "../shared/types.ts";
import { parseRoute } from "./router.ts";

const app = requiredElement<HTMLElement>(document, "#app");
globalThis.addEventListener("hashchange", () => void render());
chrome.runtime.onMessage.addListener((message) => {
  if (
    message.type === "navigate-capture" &&
    typeof message.captureId === "string"
  ) {
    location.hash = `#/capture/${encodeURIComponent(message.captureId)}`;
    return;
  }
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
  const loadingPage = route.name === "settings" || route.name === "channels" ||
      route.name === "tags"
    ? route.name
    : undefined;
  if (loadingPage) {
    app.setAttribute("aria-busy", "true");
    renderPageLoading(loadingPage);
  }
  try {
    if (route.name === "capture") await renderCapture(route.captureId);
    else if (route.name === "settings") await renderSettings();
    else if (route.name === "channels") await renderChannels();
    else if (route.name === "tags") await renderTags();
    else await renderLibrary();
    app.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  } catch (error) {
    showError(error);
  } finally {
    app.removeAttribute("aria-busy");
  }
}

function renderPageLoading(page: "settings" | "channels" | "tags"): void {
  const title = page[0].toUpperCase() + page.slice(1);
  app.innerHTML =
    `<section class="stack settings page-loading"><h1 tabindex="-1">${title}</h1><div class="card page-loader" role="status"><span class="spinner" aria-hidden="true"></span><div><strong>Loading ${
      page === "settings" ? "configuration" : page
    }…</strong><p class="muted">Fetching the latest workspace data.</p></div></div><div class="loading-card" aria-hidden="true"><span></span><span></span><span></span></div></section>`;
}

type CaptureFallback = { url?: string; title?: string; selectedQuote?: string };
async function renderCapture(captureId?: string): Promise<void> {
  app.innerHTML =
    `<section class="stack loading-view"><div class="eyebrow">New capture</div><h1 tabindex="-1">Reading page</h1><div class="skeleton"></div><p class="muted">Extracting useful context and preparing an editable draft…</p></section>`;
  if (!captureId) return renderManual({});
  const pending = await getPendingCapture(captureId);
  if (pending?.state === "failed") {
    return renderManual(pending.fallback ?? {}, pending.error);
  }
  if (pending?.state === "extracting" || pending?.state === "preparing") {
    const heading = pending.state === "extracting"
      ? "Reading page"
      : "Writing your draft";
    requiredElement<HTMLElement>(app, "h1").textContent = heading;
    setTimeout(() => void render(), 500);
    return;
  }
  const resourceId = pending?.captureId === captureId && pending.resourceId
    ? pending.resourceId
    : captureId;
  const resource = await api.getResource(resourceId);
  await renderEditor(resource);
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
  app.innerHTML =
    `<section class="stack"><div class="eyebrow">Fallback</div><h1>Capture manually</h1>${
      error ? `<p class="notice error">${escapeHtml(error)}</p>` : ""
    }<form class="stack"><label>URL<input name="url" type="url" required value="${
      escapeHtml(fallback.url)
    }"></label><label>Title<input name="title" required value="${
      escapeHtml(fallback.title)
    }"></label><label>Selected quote<textarea name="selectedQuote">${
      escapeHtml(fallback.selectedQuote)
    }</textarea></label><button data-variant="primary">Capture &amp; prepare</button></form></section>`;
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
      pendingCapture: { captureId, resourceId: resource.id, state: "ready" },
    });
    location.hash = `#/capture/${captureId}`;
  });
}

async function renderEditor(resource: ApiResource): Promise<void> {
  const channels = await api.channels().catch(() => []);
  const tags = await api.tags().catch(() => []);
  const suggestion = resource.enrichment?.draft?.channelSuggestion;
  const suggestedTags = resource.enrichment?.draft?.suggestedTagSlugs ?? [];
  const selectedTags = [
    ...new Set([
      ...resource.tags.map((tag) => tag.slug),
      ...suggestedTags,
    ]),
  ];
  app.innerHTML =
    `<section class="stack editor"><div class="title-row"><div><div class="eyebrow">Captured</div><h1 tabindex="-1">Review draft</h1></div><span class="status ${
      escapeHtml(resource.enrichmentStatus)
    }">${
      escapeHtml(resource.enrichmentStatus)
    }</span></div><article class="source-card"><strong>${
      escapeHtml(resource.title)
    }</strong><a class="source-url" href="${
      escapeHtml(resource.originalUrl)
    }" target="_blank" rel="noopener noreferrer">${
      escapeHtml(resource.sourceDomain)
    } ↗</a>${
      resource.selectedQuote
        ? `<blockquote>“${escapeHtml(resource.selectedQuote)}”</blockquote>`
        : ""
    }</article>${
      resource.enrichmentStatus === "failed"
        ? `<p class="notice error" role="alert"><strong>AI draft failed.</strong> ${
          escapeHtml(
            resource.enrichmentError ?? "You can edit the capture manually.",
          )
        } <button type="button" data-variant="ghost" data-size="compact" data-retry-ai>Retry</button></p>`
        : resource.enrichmentStatus === "preparing"
        ? '<p class="notice" role="status">Preparing the AI draft… This view updates automatically.</p>'
        : `<details class="ai-note"><summary>AI routing note</summary><p>${
          suggestion
            ? `${escapeHtml(suggestion.confidence)} confidence — ${
              escapeHtml(suggestion.reason)
            }`
            : "No channel recommendation."
        }</p></details>`
    }<form class="stack"><label>Title<input name="title" required value="${
      escapeHtml(resource.title)
    }"></label><label>Summary<textarea name="summary">${
      escapeHtml(resource.summary)
    }</textarea></label><label>Why it is useful<textarea name="whyUseful">${
      escapeHtml(resource.whyUseful)
    }</textarea></label><label>Your note<textarea name="personalNote">${
      escapeHtml(resource.personalNote)
    }</textarea></label><label>Selected context<textarea name="selectedQuote">${
      escapeHtml(resource.selectedQuote)
    }</textarea></label><label>Tags<input name="tagSlugs" list="known-tags" value="${
      escapeHtml(selectedTags.join(", "))
    }" placeholder="deno, discord"></label><datalist id="known-tags">${
      tags.map((tag) => `<option value="${escapeHtml(tag.slug)}"></option>`)
        .join("")
    }</datalist><label>Destination<select name="channelId"><option value="">Choose a channel</option>${
      channels.filter((channel) =>
        channel.isActiveForRouting && channel.availability === "available"
      ).map((channel) =>
        `<option value="${escapeHtml(channel.id)}">#${
          escapeHtml(channel.name)
        }</option>`
      ).join("")
    }</select></label><div class="actions primary-actions"><button type="button" data-variant="secondary" data-save>Update</button><button type="button" data-variant="secondary" data-read-later>Read later</button><button data-variant="primary" data-publish disabled>Publish</button></div><details class="danger-zone"><summary>More actions</summary><div class="actions"><button type="button" data-variant="ghost" data-archive>${
      resource.archivedAt ? "Restore from archive" : "Archive"
    }</button><button type="button" data-variant="danger" data-delete>Delete permanently</button></div></details></form></section>`;
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
  if (suggestion?.channelId) {
    select.value = suggestion.channelId;
  }
  const publish = requiredElement<HTMLButtonElement>(form, "[data-publish]");
  const sync = (): void => {
    publish.disabled = !select.value;
  };
  select.addEventListener("change", sync);
  sync();
  const resourcePatch = () => ({
    title: formValue(form, "title"),
    summary: optionalFormValue(form, "summary"),
    whyUseful: optionalFormValue(form, "whyUseful"),
    personalNote: optionalFormValue(form, "personalNote"),
    selectedQuote: optionalFormValue(form, "selectedQuote"),
    tagSlugs: formValue(form, "tagSlugs").split(",").map((tag) => tag.trim())
      .filter(Boolean),
  });
  requiredElement<HTMLButtonElement>(form, "[data-save]").addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      try {
        await api.updateResource(resource.id, resourcePatch());
        button.textContent = "Saved";
      } finally {
        button.disabled = false;
      }
    },
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const channelId = select.value;
    if (!channelId) return;
    publish.disabled = true;
    await api.updateResource(resource.id, resourcePatch());
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
          await api.updateResource(resource.id, resourcePatch());
          showSuccess(await api.readLater(resource.id));
        } catch (cause) {
          showError(cause);
        } finally {
          button.disabled = false;
        }
      },
    );
  requiredElement<HTMLButtonElement>(form, "[data-archive]").addEventListener(
    "click",
    async () => {
      await api.updateResource(resource.id, { archived: !resource.archivedAt });
      location.hash = "#/library";
    },
  );
  requiredElement<HTMLButtonElement>(form, "[data-delete]").addEventListener(
    "click",
    async () => {
      if (
        !confirm(
          `Permanently delete “${resource.title}”? This cannot be undone.`,
        )
      ) return;
      await api.deleteResource(resource.id);
      location.hash = "#/library";
    },
  );
}

async function renderLibrary(): Promise<void> {
  app.innerHTML =
    `<section class="stack"><h1 tabindex="-1">Library</h1><form role="search"><label>Search<input name="q" type="search" placeholder="Title, URL, note, tag…"></label><label>State<select name="state"><option value="">All active</option><option value="inbox">Inbox</option><option value="read_later">Read Later</option><option value="shared">Shared</option><option value="archived">Archived</option></select></label><label>Domain<input name="domain" placeholder="example.com"></label><label>AI status<select name="enrichmentStatus"><option value="">Any</option><option value="failed">Failed</option><option value="preparing">Preparing</option><option value="ready">Ready</option></select></label><label>Sort<select name="sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option></select></label><button data-variant="secondary">Apply</button></form><div data-results><div class="skeleton" role="status" aria-label="Loading resources"></div></div></section>`;
  const form = requiredElement<HTMLFormElement>(app, "form");
  const results = requiredElement<HTMLElement>(app, "[data-results]");
  const load = async (): Promise<void> => {
    const state = formValue(form, "state") as
      | ""
      | "inbox"
      | "read_later"
      | "shared"
      | "archived";
    const enrichmentStatus = formValue(form, "enrichmentStatus") as
      | ""
      | "preparing"
      | "ready"
      | "failed";
    const items = await api.listResources(
      formValue(form, "q"),
      {
        archived: state ? undefined : false,
        state: state || undefined,
        domain: optionalFormValue(form, "domain") ?? undefined,
        enrichmentStatus: enrichmentStatus || undefined,
        sort: formValue(form, "sort") as "newest" | "oldest" | "updated",
      },
    );
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
        }" data-component="button" data-variant="secondary" data-size="compact">Review</a></article>`
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
  const connected = config.accessToken
    ? await api.session().then(() => true).catch(() => false)
    : false;
  app.innerHTML =
    `<section class="stack settings"><h1 tabindex="-1">Settings</h1><form class="card stack settings-card"><h2>API</h2><label>API base URL<input name="apiBaseUrl" type="url" required value="${
      escapeHtml(config.apiBaseUrl)
    }"></label><button data-variant="primary">Save API URL</button></form><section class="card stack settings-card"><h2>Discord account</h2><p class="notice">${
      connected ? "Connected as the configured owner." : "Not connected."
    }</p><button data-variant="secondary" data-connect>${
      connected ? "Reconnect Discord" : "Connect Discord"
    }</button></section></section>`;
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
}

async function renderChannels(): Promise<void> {
  const config = await getConfig();
  let connected = false;
  let guilds: Array<{ id: string; name: string }> = [];
  let storedChannels: DiscordChannel[] = [];
  if (config.accessToken) {
    try {
      await api.session();
      guilds = await api.guilds();
      storedChannels = await api.channels().catch(() => []);
      connected = true;
    } catch {
      connected = false;
    }
  }
  if (!connected) {
    app.innerHTML =
      '<section class="stack settings"><h1 tabindex="-1">Channels</h1><p class="notice">Connect Discord in Settings before importing channels.</p><a data-component="button" data-variant="secondary" href="#/settings">Open Settings</a></section>';
    return;
  }
  app.innerHTML =
    `<section class="stack settings"><h1 tabindex="-1">Channels</h1><section class="card stack settings-card"><div class="section-heading"><div><h2>Discord channels</h2><p class="muted">Choose a server, sync its channels, then configure routing.</p></div></div><div class="channel-sync-row">${
      guilds.length
        ? `<label class="server-picker">Server<select data-guild>${
          guilds.map((guild) =>
            `<option value="${escapeHtml(guild.id)}" ${
              guild.id === config.selectedGuildId ? "selected" : ""
            }>${escapeHtml(guild.name)}</option>`
          ).join("")
        }</select></label>`
        : ""
    }<button data-variant="primary" data-sync ${
      guilds.length ? "" : "disabled"
    }>Sync channels now</button></div><div data-channels>${
      channelSettings(storedChannels)
    }</div></section></section>`;
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
        channelSettings(channels);
      bindChannelSettings();
    } finally {
      sync.disabled = false;
    }
  });
  bindChannelSettings();
}

async function renderTags(): Promise<void> {
  const config = await getConfig();
  const connected = config.accessToken
    ? await api.session().then(() => true).catch(() => false)
    : false;
  if (!connected) {
    app.innerHTML =
      '<section class="stack settings"><h1 tabindex="-1">Tags</h1><p class="notice">Connect Discord in Settings before managing tags.</p><a data-component="button" data-variant="secondary" href="#/settings">Open Settings</a></section>';
    return;
  }
  const storedTags = await api.tags().catch(() => []);
  app.innerHTML =
    `<section class="stack settings"><h1 tabindex="-1">Tags</h1><section class="card stack settings-card"><div class="section-heading"><div><h2>Canonical tags</h2><p class="muted">Maintain bilingual labels and aliases used by AI suggestions.</p></div></div><form data-tag-form class="stack"><label>Slug<input name="slug" required></label><label>English label<input name="english" required></label><label>Portuguese label<input name="portuguese" required></label><label>Aliases, comma separated<input name="aliases"></label><button data-variant="primary">Add canonical tag</button></form><p class="muted" data-tags>${
      storedTags.length
        ? storedTags.map((tag) => `#${escapeHtml(tag.slug)}`).join(" · ")
        : "No tags yet."
    }</p><div class="tag-list" data-tag-list>${
      tagSettings(storedTags)
    }</div></section></section>`;
  requiredElement<HTMLFormElement>(app, "[data-tag-form]").addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const tagForm = event.currentTarget as HTMLFormElement;
      const tag = await api.createTag({
        slug: formValue(tagForm, "slug"),
        english: formValue(tagForm, "english"),
        portuguese: formValue(tagForm, "portuguese"),
        aliases: formValue(tagForm, "aliases").split(",").map((value) =>
          value.trim()
        ).filter(
          Boolean,
        ),
      });
      requiredElement<HTMLElement>(app, "[data-tags]").textContent =
        `Added #${tag.slug}`;
      tagForm.reset();
    },
  );
  app.querySelectorAll<HTMLFormElement>("[data-tag-edit]").forEach(
    (tagForm) => {
      tagForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = tagForm.dataset.tagId!;
        const action = (event.submitter as HTMLButtonElement | null)?.value;
        if (action === "merge") {
          const targetId = formValue(tagForm, "targetId");
          if (!targetId || !confirm("Merge this tag into the selected tag?")) {
            return;
          }
          await api.mergeTag(id, targetId);
        } else {
          await api.updateTag(id, {
            slug: formValue(tagForm, "slug"),
            english: formValue(tagForm, "english"),
            portuguese: formValue(tagForm, "portuguese"),
            aliases: formValue(tagForm, "aliases").split(",").map((value) =>
              value.trim()
            ).filter(Boolean),
          });
        }
        await renderTags();
      });
    },
  );
}

function bindChannelSettings(): void {
  const readLaterSelect = app.querySelector<HTMLSelectElement>(
    "[data-read-later-channel]",
  );
  readLaterSelect?.addEventListener("change", async () => {
    const previousId = readLaterSelect.dataset.current ?? "";
    const nextId = readLaterSelect.value;
    if (nextId === previousId) return;
    readLaterSelect.disabled = true;
    const status = app.querySelector<HTMLElement>("[data-read-later-status]");
    try {
      if (nextId) {
        await api.updateChannel(nextId, {
          isReadLater: true,
          isActiveForRouting: true,
        });
        const routingToggle = app.querySelector<HTMLInputElement>(
          `[data-channel-id="${CSS.escape(nextId)}"] [name="active"]`,
        );
        if (routingToggle) routingToggle.checked = true;
      } else if (previousId) {
        await api.updateChannel(previousId, { isReadLater: false });
      }
      readLaterSelect.dataset.current = nextId;
      if (status) status.textContent = "Read Later destination saved.";
    } catch (cause) {
      readLaterSelect.value = previousId;
      showInlineError(status, cause);
    } finally {
      readLaterSelect.disabled = false;
    }
  });
  app.querySelectorAll<HTMLFormElement>("[data-channel-form]").forEach(
    (channelForm) => {
      channelForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = requiredElement<HTMLButtonElement>(
          channelForm,
          "button",
        );
        button.disabled = true;
        try {
          await api.updateChannel(channelForm.dataset.channelId!, {
            routingDescription: optionalFormValue(
              channelForm,
              "routingDescription",
            ),
            isActiveForRouting:
              new FormData(channelForm).get("active") === "on",
          });
          button.textContent = "Saved";
        } finally {
          button.disabled = false;
        }
      });
    },
  );
}

function tagSettings(tags: Awaited<ReturnType<typeof api.tags>>): string {
  return tags.map((tag) => {
    const english = tag.labels.find((label) => label.language === "en")?.name ??
      tag.slug;
    const portuguese = tag.labels.find((label) =>
      label.language === "pt-BR"
    )?.name ?? tag.slug;
    return `<form class="card stack" data-tag-edit data-tag-id="${
      escapeHtml(tag.id)
    }"><label>Slug<input name="slug" value="${
      escapeHtml(tag.slug)
    }"></label><label>English<input name="english" value="${
      escapeHtml(english)
    }"></label><label>Portuguese<input name="portuguese" value="${
      escapeHtml(portuguese)
    }"></label><label>Aliases<input name="aliases" value="${
      escapeHtml(tag.aliases.join(", "))
    }"></label><div class="actions"><button data-variant="secondary" value="save">Save tag</button><select name="targetId"><option value="">Merge into…</option>${
      tags.filter((target) => target.id !== tag.id).map((target) =>
        `<option value="${escapeHtml(target.id)}">#${
          escapeHtml(target.slug)
        }</option>`
      ).join("")
    }</select><button data-variant="danger" value="merge">Merge</button></div></form>`;
  }).join("");
}

function channelSettings(channels: DiscordChannel[]): string {
  if (!channels.length) {
    return '<p class="notice">No imported text channels yet.</p>';
  }
  const available = channels.filter((channel) =>
    channel.availability === "available"
  );
  const readLaterId = available.find((channel) => channel.isReadLater)?.id ??
    "";
  return `<section class="channel-settings"><div class="channel-settings-head"><div><h3>Imported channels</h3><p class="muted">${available.length} available · ${channels.length} imported</p></div></div><label class="read-later-picker">Read Later destination<select data-read-later-channel data-current="${
    escapeHtml(readLaterId)
  }"><option value="">Not configured</option>${
    available.map((channel) =>
      `<option value="${escapeHtml(channel.id)}" ${
        channel.id === readLaterId ? "selected" : ""
      }>#${escapeHtml(channel.name)}${
        channel.parentName ? ` — ${escapeHtml(channel.parentName)}` : ""
      }</option>`
    ).join("")
  }</select><span class="field-hint" data-read-later-status>Links sent to Read Later will use this channel.</span></label><div class="channel-list">${
    channels.map((channel) =>
      `<form class="channel-row" data-channel-form data-channel-id="${
        escapeHtml(channel.id)
      }"><div class="channel-row-head"><div class="channel-identity"><strong>#${
        escapeHtml(channel.name)
      }</strong><span class="muted">${
        escapeHtml(channel.parentName ?? "No category")
      }</span></div><label class="switch-control"><input type="checkbox" name="active" ${
        channel.isActiveForRouting ? "checked" : ""
      } ${
        channel.availability === "available" ? "" : "disabled"
      }><span>Active for routing</span></label></div><p class="channel-topic">${
        escapeHtml(channel.discordTopic ?? "No Discord topic")
      }</p><label>Routing description<textarea name="routingDescription" placeholder="What belongs in this channel?">${
        escapeHtml(channel.routingDescription)
      }</textarea></label><div class="channel-row-footer"><span class="availability ${
        escapeHtml(channel.availability)
      }">${
        escapeHtml(channel.availability)
      }</span><button data-variant="secondary" data-size="compact">Save routing</button></div></form>`
    ).join("")
  }</div></section>`;
}

function showInlineError(element: HTMLElement | null, cause: unknown): void {
  if (!element) return;
  element.textContent = cause instanceof Error
    ? cause.message
    : "Could not save";
  element.classList.add("inline-error");
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
  const handoff = new URLSearchParams(new URL(result).hash.slice(1));
  const refreshToken = handoff.get("refresh_token");
  const sessionId = handoff.get("session_id");
  if (!accessToken || !refreshToken || !sessionId) {
    throw new Error("Discord connection did not return a session");
  }
  await saveConfig({ ...config, accessToken, refreshToken, sessionId });
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
