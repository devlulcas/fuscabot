import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { UnsavedChanges } from "../../components/unsaved-changes/unsaved-changes.tsx";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import { tagsQueryOptions } from "./api/tags.queries.ts";
import { useTagMutations } from "./api/tags.mutations.ts";
import { CreateTagForm } from "./components/create-tag-form.tsx";
import { TagList } from "./components/tag-list.tsx";
import type { TagInput } from "./model/tag-types.ts";
import { PageStack } from "../../components/layout/page-stack.tsx";
import { Card } from "../../components/layout/card.tsx";
import { Muted } from "../../components/typography/muted.tsx";
import css from "./tags-route.module.css";

export function TagsRoute() {
  const tags = useQuery(tagsQueryOptions());
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const markDirty = useCallback(
    (key: string) => setDirty((current) => new Set(current).add(key)),
    [],
  );
  const clearDirty = useCallback((key: string) =>
    setDirty((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    }), []);
  const mutations = useTagMutations(clearDirty);
  if (tags.isPending) return <PageLoading label="Loading tags…" />;
  if (tags.isError) {
    return (
      <PageError
        error={tags.error}
        retry={() => void tags.refetch()}
      />
    );
  }
  const error = mutations.create.error ?? mutations.update.error ??
    mutations.merge.error;
  return (
    <PageStack className={css.settings}>
      <h1>Tags</h1>
      <Card className={css.settingsCard}>
        <div>
          <h2>Canonical Tags</h2>
          <Muted>
            Maintain bilingual labels and aliases used by AI suggestions.
          </Muted>
        </div>
        <CreateTagForm
          pending={mutations.create.isPending}
          onDirty={() => markDirty("create")}
          onCreate={(input, form) =>
            mutations.create.mutate(input, { onSuccess: () => form.reset() })}
        />
        {error ? <InlineNotice error>{error.message}</InlineNotice> : null}
        {tags.isRefetchError
          ? (
            <InlineNotice error>
              Couldn’t refresh tags. Showing saved data.
            </InlineNotice>
          )
          : null}
        <TagList
          tags={tags.data}
          pending={mutations.update.isPending || mutations.merge.isPending}
          onDirty={markDirty}
          onSave={(id, input: TagInput) =>
            mutations.update.mutate({ id, input })}
          onMerge={(sourceId, targetId) => {
            if (confirm("Merge this tag into the selected tag?")) {mutations
                .merge.mutate({ sourceId, targetId });}
          }}
        />
      </Card>
      <UnsavedChanges
        when={dirty.size > 0 && !mutations.create.isPending &&
          !mutations.update.isPending && !mutations.merge.isPending}
      />
    </PageStack>
  );
}
