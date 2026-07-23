import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../shared/api.ts";
import { savePendingCapture } from "../../../shared/pending-capture.ts";
import type { CapturePayload } from "../../../shared/types.ts";
import {
  safeDiscordMessageUrl,
  safeWebUrl,
} from "../../../shared/ui_security.ts";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import page from "../../components/layout/page.module.css";
import {
  channelsQuery,
  pendingCaptureQuery,
  resourceQuery,
  tagsQuery,
} from "../../data/queries.ts";
import { queryKeys } from "../../data/query-keys.ts";
import {
  canPublish,
  resolveDestination,
  saveBeforeDelivery,
} from "./capture-policy.ts";

export function CaptureRoute() {
  const { captureId } = useParams();
  if (!captureId) return <ManualCapture />;
  return <CaptureById captureId={captureId} />;
}

function CaptureById({ captureId }: { captureId: string }) {
  const pending = useQuery(pendingCaptureQuery(captureId));
  if (pending.isPending) return <PageLoading label="Reading capture state…" />;
  if (pending.data?.state === "failed") {
    return (
      <ManualCapture
        fallback={pending.data.fallback}
        error={pending.data.error}
      />
    );
  }
  if (
    pending.data?.state === "extracting" || pending.data?.state === "preparing"
  ) {
    return (
      <section className={page.stack}>
        <p className={page.eyebrow}>New Capture</p>
        <h1>
          {pending.data.state === "extracting"
            ? "Reading Page"
            : "Saving Capture"}
        </h1>
        <PageLoading label="This view updates automatically…" />
      </section>
    );
  }
  const resourceId = pending.data?.resourceId ?? captureId;
  return <ResourceEditor resourceId={resourceId} />;
}

function ManualCapture(
  { fallback = {}, error }: {
    fallback?: { url?: string; title?: string; selectedQuote?: string };
    error?: string;
  },
) {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const captureId = crypto.randomUUID();
      const payload: CapturePayload = {
        captureId,
        url: value(form, "url"),
        title: value(form, "title"),
        selectedQuote: optionalValue(form, "selectedQuote"),
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
      await savePendingCapture({
        captureId,
        resourceId: resource.id,
        state: "ready",
      });
      return captureId;
    },
    onSuccess: (id) => {
      setDirty(false);
      navigate(`/capture/${id}`);
    },
  });
  return (
    <section className={page.stack}>
      <p className={page.eyebrow}>Fallback</p>
      <h1>Capture Manually</h1>
      {error ? <InlineNotice error>{error}</InlineNotice> : null}
      <form
        className={page.form}
        onInput={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          URL<input
            name="url"
            type="url"
            required
            autoComplete="off"
            defaultValue={fallback.url}
            placeholder="https://example.com/…"
          />
        </label>
        <label>
          Title<input
            name="title"
            required
            autoComplete="off"
            defaultValue={fallback.title}
          />
        </label>
        <label>
          Selected Quote<textarea
            name="selectedQuote"
            defaultValue={fallback.selectedQuote}
          />
        </label>
        {mutation.error
          ? <InlineNotice error>{mutation.error.message}</InlineNotice>
          : null}
        <button
          type="submit"
          className={`${page.button} ${page.primary}`}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : "Save Capture"}
        </button>
      </form>
      <UnsavedChanges when={dirty && !mutation.isPending} />
    </section>
  );
}

function ResourceEditor({ resourceId }: { resourceId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const resource = useQuery(resourceQuery(resourceId));
  const channels = useQuery(channelsQuery());
  const tags = useQuery(tagsQuery());
  const [dirtyStatus, setDirtyStatus] = useState<string | null>(null);
  const [channelSelection, setChannelSelection] = useState({
    enrichmentStatus: "",
    channelId: "",
  });
  const [notice, setNotice] = useState<React.ReactNode>();
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.resource(resourceId) }),
      client.invalidateQueries({ queryKey: queryKeys.resourceLists }),
    ]);
  };
  const persistDraft = async (patch: ReturnType<typeof resourcePatch>) => {
    const updated = await api.updateResource(resourceId, patch);
    client.setQueryData(queryKeys.resource(resourceId), updated);
    await client.invalidateQueries({ queryKey: queryKeys.resourceLists });
    setDirtyStatus(null);
    return updated;
  };
  const save = useMutation({
    mutationFn: persistDraft,
    onSuccess: () => {
      setNotice("Saved.");
    },
  });
  const retry = useMutation({
    mutationFn: () => api.retryEnrichment(resourceId),
    onSuccess: async (result) => {
      await invalidate();
      if (result.status === "ready") {
        setNotice("AI fields updated. Review them before publishing.");
      }
    },
  });
  const publish = useMutation({
    mutationFn: (
      { destination, patch }: {
        destination: string;
        patch: ReturnType<typeof resourcePatch>;
      },
    ) =>
      saveBeforeDelivery(
        patch,
        persistDraft,
        () => api.publish(resourceId, destination),
      ),
    onSuccess: async (delivery) => {
      await invalidate();
      const url = safeDiscordMessageUrl(delivery.discordUrl);
      setNotice(
        <>
          Published successfully.{url
            ? (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Open in Discord
                </a>
              </>
            )
            : null}
        </>,
      );
    },
  });
  const readLater = useMutation({
    mutationFn: (patch: ReturnType<typeof resourcePatch>) =>
      saveBeforeDelivery(
        patch,
        persistDraft,
        () => api.readLater(resourceId),
      ),
    onSuccess: async () => {
      await invalidate();
      setNotice("Sent to Read Later.");
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      api.updateResource(resourceId, { archived: !resource.data?.archivedAt }),
    onSuccess: async () => {
      await invalidate();
      navigate("/library");
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteResource(resourceId),
    onSuccess: async () => {
      client.removeQueries({ queryKey: queryKeys.resource(resourceId) });
      await client.invalidateQueries({ queryKey: queryKeys.resourceLists });
      navigate("/library");
    },
  });
  if (resource.isPending) return <PageLoading label="Loading resource…" />;
  if (resource.isError) {
    return (
      <PageError
        error={resource.error}
        retry={() => void resource.refetch()}
      />
    );
  }
  const item = resource.data;
  const publishable = canPublish(item.enrichmentStatus);
  const dirty = dirtyStatus === item.enrichmentStatus;
  const busy = save.isPending || publish.isPending || readLater.isPending ||
    archive.isPending || remove.isPending;
  const suggestion = item.enrichment?.draft?.channelSuggestion;
  const selectedTags = [
    ...new Set([
      ...item.tags.map((tag) => tag.slug),
      ...(item.enrichment?.draft?.suggestedTagSlugs ?? []),
    ]),
  ];
  const availableChannels =
    channels.data?.filter((channel) =>
      channel.isActiveForRouting && channel.availability === "available"
    ) ?? [];
  const destination = resolveDestination({
    enrichmentStatus: item.enrichmentStatus,
    selectionStatus: channelSelection.enrichmentStatus,
    selectedChannelId: channelSelection.channelId,
    suggestedChannelId: suggestion?.channelId,
    availableChannelIds: new Set(
      availableChannels.map((channel) => channel.id),
    ),
  });
  return (
    <section className={page.stack}>
      <div className={page.titleRow}>
        <div>
          <p className={page.eyebrow}>Captured</p>
          <h1>Review Draft</h1>
        </div>
        <span
          className={`${page.status} ${
            item.enrichmentStatus === "ready"
              ? page.ready
              : item.enrichmentStatus === "failed"
              ? page.failed
              : ""
          }`}
        >
          {item.enrichmentStatus}
        </span>
      </div>
      <article className={page.source}>
        <strong>{item.title}</strong>
        <a
          className={page.muted}
          href={safeWebUrl(item.originalUrl) ?? "about:blank"}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.sourceDomain} ↗
        </a>
        {item.selectedQuote
          ? <blockquote>“{item.selectedQuote}”</blockquote>
          : null}
      </article>
      {item.enrichmentStatus === "preparing"
        ? (
          <InlineNotice>
            <strong>Basic page details saved.</strong>{" "}
            Auto-fill the summary, tags, and destination when you’re ready.{" "}
            <button
              type="button"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              {retry.isPending ? "Auto-filling…" : "Auto-fill & Go"}
            </button>
          </InlineNotice>
        )
        : null}
      {item.enrichmentStatus === "failed"
        ? (
          <InlineNotice error>
            <strong>AI draft failed.</strong>{" "}
            {item.enrichmentError ?? "You can edit manually."}{" "}
            <button
              type="button"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              {retry.isPending ? "Retrying…" : "Retry AI auto-fill"}
            </button>
          </InlineNotice>
        )
        : null}
      {notice ? <InlineNotice>{notice}</InlineNotice> : null}
      {resource.isRefetchError
        ? (
          <InlineNotice error>
            Couldn’t refresh this resource. Showing saved data.
          </InlineNotice>
        )
        : null}
      <form
        key={item.enrichmentStatus}
        className={page.form}
        onInput={() => setDirtyStatus(item.enrichmentStatus)}
        onSubmit={(event) => {
          event.preventDefault();
          publish.mutate({
            destination,
            patch: resourcePatch(new FormData(event.currentTarget)),
          });
        }}
      >
        <label>
          Title<input name="title" required defaultValue={item.title} />
        </label>
        <label>
          Summary<textarea name="summary" defaultValue={item.summary ?? ""} />
        </label>
        <label>
          Your Note<textarea
            name="personalNote"
            defaultValue={item.personalNote ?? ""}
          />
        </label>
        <label>
          Selected Context<textarea
            name="selectedQuote"
            defaultValue={item.selectedQuote ?? ""}
          />
        </label>
        <label>
          Tags<input
            name="tagSlugs"
            list="known-tags"
            defaultValue={selectedTags.join(", ")}
            placeholder="deno, discord…"
          />
        </label>
        <datalist id="known-tags">
          {tags.data?.map((tag) => <option key={tag.id} value={tag.slug} />)}
        </datalist>
        <label>
          Destination<select
            name="channelId"
            value={destination}
            onChange={(event) => {
              setChannelSelection({
                enrichmentStatus: item.enrichmentStatus,
                channelId: event.target.value,
              });
              setDirtyStatus(item.enrichmentStatus);
            }}
          >
            <option value="">Choose a channel</option>
            {availableChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </label>
        {channels.isError
          ? (
            <InlineNotice error>
              Couldn’t load destinations. Retry from the Channels page.
            </InlineNotice>
          )
          : null}
        {tags.isError
          ? (
            <InlineNotice error>
              Couldn’t load known tags. You can still enter tags manually.
            </InlineNotice>
          )
          : null}
        {save.error || retry.error || publish.error || readLater.error ||
            archive.error ||
            remove.error
          ? (
            <InlineNotice error>
              {(save.error ?? retry.error ?? publish.error ?? readLater.error ??
                archive.error ?? remove.error)?.message}
            </InlineNotice>
          )
          : null}
        <div className={page.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={(event) =>
              save.mutate(
                resourcePatch(new FormData(event.currentTarget.form!)),
              )}
          >
            {save.isPending ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={!publishable || busy}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (!form?.reportValidity()) return;
              readLater.mutate(resourcePatch(new FormData(form)));
            }}
          >
            {readLater.isPending ? "Saving & Sending…" : "Read Later"}
          </button>
          <button
            type="submit"
            className={page.primary}
            disabled={!publishable || !destination || busy}
          >
            {publish.isPending ? "Saving & Publishing…" : "Publish"}
          </button>
        </div>
        <details className={page.details}>
          <summary>More Actions</summary>
          <div className={page.actions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => archive.mutate()}
            >
              {item.archivedAt ? "Restore from Archive" : "Archive"}
            </button>
            <button
              type="button"
              className={page.danger}
              disabled={busy}
              onClick={() => {
                if (
                  !confirm(
                    `Permanently delete “${item.title}”? This cannot be undone.`,
                  )
                ) return;
                remove.mutate();
              }}
            >
              Delete Permanently
            </button>
          </div>
        </details>
      </form>
      <UnsavedChanges when={dirty && !busy} />
    </section>
  );
}

function resourcePatch(form: FormData) {
  return {
    title: value(form, "title"),
    summary: optionalValue(form, "summary"),
    personalNote: optionalValue(form, "personalNote"),
    selectedQuote: optionalValue(form, "selectedQuote"),
    tagSlugs: value(form, "tagSlugs").split(",").map((tag) => tag.trim())
      .filter(Boolean),
  };
}
function value(form: FormData, name: string): string {
  const entry = form.get(name);
  return typeof entry === "string" ? entry : "";
}
function optionalValue(form: FormData, name: string): string | null {
  return value(form, name).trim() || null;
}
