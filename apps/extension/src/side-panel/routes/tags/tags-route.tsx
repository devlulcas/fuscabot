import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CanonicalTag } from "../../../shared/api.ts";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import page from "../../components/layout/page.module.css";
import { tagsQuery } from "../../data/queries.ts";
import { queryKeys } from "../../data/query-keys.ts";

export function TagsRoute() {
  const client = useQueryClient();
  const tags = useQuery(tagsQuery());
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: queryKeys.tags });
  };
  const create = useMutation({
    mutationFn: api.createTag,
    onSuccess: async () => {
      await invalidate();
      setDirty((current) => {
        const next = new Set(current);
        next.delete("create");
        return next;
      });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TagInput }) =>
      api.updateTag(id, input),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        invalidate(),
        client.invalidateQueries({ queryKey: queryKeys.resources }),
      ]);
      setDirty((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
    },
  });
  const merge = useMutation({
    mutationFn: (
      { sourceId, targetId }: { sourceId: string; targetId: string },
    ) => api.mergeTag(sourceId, targetId),
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        invalidate(),
        client.invalidateQueries({ queryKey: queryKeys.resources }),
      ]);
      setDirty((current) => {
        const next = new Set(current);
        next.delete(variables.sourceId);
        return next;
      });
    },
  });
  if (tags.isPending) return <PageLoading label="Loading tags…" />;
  if (tags.isError) {
    return (
      <PageError
        error={tags.error}
        retry={() => void tags.refetch()}
      />
    );
  }
  const error = create.error ?? update.error ?? merge.error;
  return (
    <section className={`${page.stack} ${page.settings}`}>
      <h1>Tags</h1>
      <section className={`${page.card} ${page.settingsCard}`}>
        <div>
          <h2>Canonical Tags</h2>
          <p className={page.muted}>
            Maintain bilingual labels and aliases used by AI suggestions.
          </p>
        </div>
        <form
          className={page.form}
          onInput={() => setDirty((current) => new Set(current).add("create"))}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            create.mutate(tagInput(new FormData(form)), {
              onSuccess: () => form.reset(),
            });
          }}
        >
          <label>
            Slug<input name="slug" required autoComplete="off" />
          </label>
          <label>
            English Label<input name="english" required autoComplete="off" />
          </label>
          <label>
            Portuguese Label<input
              name="portuguese"
              required
              autoComplete="off"
            />
          </label>
          <label>
            Aliases, Comma Separated<input name="aliases" autoComplete="off" />
          </label>
          <button
            type="submit"
            className={`${page.button} ${page.primary}`}
            disabled={create.isPending}
          >
            Add Canonical Tag
          </button>
        </form>
        {error ? <InlineNotice error>{error.message}</InlineNotice> : null}
        {tags.isRefetchError
          ? (
            <InlineNotice error>
              Couldn’t refresh tags. Showing saved data.
            </InlineNotice>
          )
          : null}
        <div className={page.list}>
          {tags.data.length
            ? tags.data.map((tag) => (
              <TagForm
                key={tag.id}
                tag={tag}
                tags={tags.data}
                pending={update.isPending || merge.isPending}
                onDirty={() =>
                  setDirty((current) => new Set(current).add(tag.id))}
                onSave={(input) => update.mutate({ id: tag.id, input })}
                onMerge={(targetId) => {
                  if (confirm("Merge this tag into the selected tag?")) {
                    merge
                      .mutate({ sourceId: tag.id, targetId });
                  }
                }}
              />
            ))
            : (
              <InlineNotice>
                No canonical tags yet. Add one above to improve AI suggestions.
              </InlineNotice>
            )}
        </div>
      </section>
      <UnsavedChanges
        when={dirty.size > 0 && !create.isPending && !update.isPending &&
          !merge.isPending}
      />
    </section>
  );
}

type TagInput = {
  slug: string;
  english: string;
  portuguese: string;
  aliases: string[];
};
function TagForm({
  tag,
  tags,
  pending,
  onDirty,
  onSave,
  onMerge,
}: {
  tag: CanonicalTag;
  tags: CanonicalTag[];
  pending: boolean;
  onDirty: () => void;
  onSave: (input: TagInput) => void;
  onMerge: (target: string) => void;
}) {
  const english = tag.labels.find((label) => label.language === "en")?.name ??
    tag.slug;
  const portuguese =
    tag.labels.find((label) => label.language === "pt-BR")?.name ?? tag.slug;
  return (
    <form
      className={`${page.card} ${page.form}`}
      onInput={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as
          | HTMLButtonElement
          | null;
        const data = new FormData(event.currentTarget);
        if (submitter?.value === "merge") {
          const target = data.get("targetId");
          if (typeof target === "string" && target) onMerge(target);
        } else onSave(tagInput(data));
      }}
    >
      <label>
        Slug<input name="slug" defaultValue={tag.slug} required />
      </label>
      <label>
        English<input name="english" defaultValue={english} required />
      </label>
      <label>
        Portuguese<input name="portuguese" defaultValue={portuguese} required />
      </label>
      <label>
        Aliases<input name="aliases" defaultValue={tag.aliases.join(", ")} />
      </label>
      <div className={page.actions}>
        <button type="submit" disabled={pending} value="save">Save Tag</button>
        <select aria-label={`Merge ${tag.slug} into`} name="targetId">
          <option value="">Merge Into…</option>
          {tags.filter((target) => target.id !== tag.id).map((target) => (
            <option key={target.id} value={target.id}>#{target.slug}</option>
          ))}
        </select>
        <button
          type="submit"
          className={page.danger}
          disabled={pending}
          value="merge"
        >
          Merge
        </button>
      </div>
    </form>
  );
}
function tagInput(data: FormData): TagInput {
  return {
    slug: text(data, "slug"),
    english: text(data, "english"),
    portuguese: text(data, "portuguese"),
    aliases: text(data, "aliases").split(",").map((alias) => alias.trim())
      .filter(Boolean),
  };
}
function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}
