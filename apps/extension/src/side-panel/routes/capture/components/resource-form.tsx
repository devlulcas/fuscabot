import type { CanonicalTag } from "../../../../shared/api.ts";
import type { DiscordChannel } from "../../../../shared/api.ts";
import type { ApiResource } from "../../../../shared/types.ts";
import { Button } from "../../../components/actions/button.tsx";
import { Actions } from "../../../components/actions/actions.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./resource-form.module.css";
import type { ResourcePatch } from "../model/capture-types.ts";
import { ResourceActions } from "./resource-actions.tsx";

export function ResourceForm({
  item,
  tags,
  channels,
  destination,
  selectedTags,
  busy,
  publishable,
  errors,
  saving,
  sending,
  publishing,
  onDirty,
  onChannelChange,
  onSave,
  onReadLater,
  onPublish,
  onRemovePublic,
  onDelete,
  removing,
}: {
  item: ApiResource;
  tags: CanonicalTag[] | undefined;
  channels: DiscordChannel[];
  destination: string;
  selectedTags: string[];
  busy: boolean;
  publishable: boolean;
  errors: React.ReactNode;
  saving: boolean;
  sending: boolean;
  publishing: boolean;
  onDirty: () => void;
  onChannelChange: (channelId: string) => void;
  onSave: (patch: ResourcePatch) => void;
  onReadLater: (patch: ResourcePatch) => void;
  onPublish: (patch: ResourcePatch) => void;
  onRemovePublic: () => void;
  onDelete: () => void;
  removing: boolean;
}) {
  const patchFrom = (form: HTMLFormElement) =>
    resourcePatch(new FormData(form));
  return (
    <Form
      key={item.enrichmentStatus}
      className={css.resourceForm}
      onInput={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        onPublish(patchFrom(event.currentTarget));
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
        {tags?.map((tag) => <option key={tag.id} value={tag.slug} />)}
      </datalist>
      <label>
        Destination<select
          name="channelId"
          value={destination}
          onChange={(event) => onChannelChange(event.target.value)}
        >
          <option value="">Choose a channel</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </label>
      {errors}
      <ResourceActions
        busy={busy}
        publishable={publishable}
        saving={saving}
        sending={sending}
        publishing={publishing}
        onSave={(form) => {
          if (form) onSave(patchFrom(form));
        }}
        onReadLater={(form) => {
          if (form?.reportValidity()) onReadLater(patchFrom(form));
        }}
      />
      <p className={css.destinationSummary}>
        Publishes to <strong>Fuscabot Archive</strong>
        {destination
          ? (
            <>
              and{" "}
              <strong>
                #{channels.find((channel) => channel.id === destination)
                  ?.name ?? "selected Discord channel"}
              </strong>
            </>
          )
          : ". Choose a Discord destination to send it there too."}
      </p>
      <details className={css.details}>
        <summary>More Actions</summary>
        <Actions className={css.detailsActions}>
          {item.publicPublication
            ? (
              <Button type="button" disabled={busy} onClick={onRemovePublic}>
                {removing ? "Removing…" : "Remove from public site"}
              </Button>
            )
            : null}
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  `Permanently delete “${item.title}”? This cannot be undone.`,
                )
              ) onDelete();
            }}
          >
            Delete Permanently
          </Button>
        </Actions>
      </details>
    </Form>
  );
}

export function resourcePatch(form: FormData): ResourcePatch {
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
