import { UnsavedChanges } from "../../../components/unsaved-changes/unsaved-changes.tsx";
import { ArrowRightIcon } from "../../../components/icons/icons.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../../components/page-status/page-status.tsx";
import css from "./resource-editor.module.css";
import { PageStack } from "../../../components/layout/page-stack.tsx";
import { canPublish } from "../model/capture-policy.ts";
import { useResourceEditor } from "../hooks/use-resource-editor.ts";
import { PublicationResults } from "./publication-results.tsx";
import { ResourceForm } from "./resource-form.tsx";
import { ResourceHeader } from "./resource-header.tsx";
import { ResourceSource } from "./resource-source.tsx";

export function ResourceEditor({ resourceId }: { resourceId: string }) {
  const editor = useResourceEditor(resourceId);
  if (editor.resource.isPending) {
    return <PageLoading label="Loading resource…" />;
  }
  if (editor.resource.isError || !editor.item) {
    return (
      <PageError
        error={editor.resource.error}
        retry={() => void editor.resource.refetch()}
      />
    );
  }
  const item = editor.item;
  const selectedTags = [
    ...new Set([
      ...item.tags.map((tag) => tag.slug),
      ...(item.enrichment?.draft?.suggestedTagSlugs ?? []),
    ]),
  ];
  const mutations = editor.mutations;
  const mutationError = mutations.save.error ?? mutations.retry.error ??
    mutations.publish.error ?? mutations.readLater.error ??
    mutations.unpublish.error ?? mutations.retryWebsite.error ??
    mutations.retryDiscord.error ?? mutations.remove.error;
  const formErrors = (
    <>
      {editor.channels.isError
        ? (
          <InlineNotice error>
            Couldn’t load destinations. Retry from the Channels page.
          </InlineNotice>
        )
        : null}
      {editor.tags.isError
        ? (
          <InlineNotice error>
            Couldn’t load known tags. You can still enter tags manually.
          </InlineNotice>
        )
        : null}
      {mutationError
        ? <InlineNotice error>{mutationError.message}</InlineNotice>
        : null}
    </>
  );
  return (
    <PageStack>
      <ResourceHeader item={item} />
      <ResourceSource item={item} />
      {item.enrichmentStatus === "preparing"
        ? (
          <InlineNotice>
            <strong>Basic page details saved.</strong>{" "}
            Auto-fill the summary, tags, and destination when you’re ready.{" "}
            <button
              type="button"
              className={css.autoFillAction}
              disabled={mutations.retry.isPending}
              onClick={editor.retryAi}
            >
              {mutations.retry.isPending ? "Auto-filling…" : (
                <>
                  Auto-fill & Go <ArrowRightIcon />
                </>
              )}
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
              disabled={mutations.retry.isPending}
              onClick={editor.retryAi}
            >
              {mutations.retry.isPending ? "Retrying…" : "Retry AI auto-fill"}
            </button>
          </InlineNotice>
        )
        : null}
      {editor.notice ? <InlineNotice>{editor.notice}</InlineNotice> : null}
      {editor.publicationResult
        ? (
          <PublicationResults
            result={editor.publicationResult}
            retryingWebsite={mutations.retryWebsite.isPending}
            retryingDiscord={mutations.retryDiscord.isPending}
            onRetryWebsite={editor.retryPublicWebsite}
            onRetryDiscord={editor.retryPublicDiscord}
          />
        )
        : null}
      {editor.resource.isRefetchError
        ? (
          <InlineNotice error>
            Couldn’t refresh this resource. Showing saved data.
          </InlineNotice>
        )
        : null}
      <ResourceForm
        item={item}
        tags={editor.tags.data}
        channels={editor.availableChannels}
        destination={editor.destination}
        selectedTags={selectedTags}
        busy={editor.busy}
        publishable={canPublish(item.enrichmentStatus)}
        errors={formErrors}
        saving={mutations.save.isPending}
        sending={mutations.readLater.isPending}
        publishing={mutations.publish.isPending}
        onDirty={editor.setDirty}
        onChannelChange={editor.setChannel}
        onSave={editor.saveDraft}
        onReadLater={editor.sendToReadLater}
        onPublish={(patch) => editor.publishDraft(editor.destination, patch)}
        onRemovePublic={editor.removeFromPublic}
        onDelete={editor.deleteResource}
        removing={mutations.unpublish.isPending}
      />
      <UnsavedChanges when={editor.dirty && !editor.busy} />
    </PageStack>
  );
}
