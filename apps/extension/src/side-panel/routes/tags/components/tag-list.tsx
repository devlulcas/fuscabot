import type { CanonicalTag } from "../../../../shared/api.ts";
import { InlineNotice } from "../../../components/page-status/page-status.tsx";
import { List } from "../../../components/list/list.tsx";
import { TagForm } from "./tag-form.tsx";
import type { TagInput } from "../model/tag-types.ts";

export function TagList({
  tags,
  pending,
  onDirty,
  onSave,
  onMerge,
}: {
  tags: CanonicalTag[];
  pending: boolean;
  onDirty: (id: string) => void;
  onSave: (id: string, input: TagInput) => void;
  onMerge: (sourceId: string, targetId: string) => void;
}) {
  if (!tags.length) {
    return (
      <InlineNotice>
        No canonical tags yet. Add one above to improve AI suggestions.
      </InlineNotice>
    );
  }
  return (
    <List>
      {tags.map((tag) => (
        <TagForm
          key={tag.id}
          tag={tag}
          tags={tags}
          pending={pending}
          onDirty={() => onDirty(tag.id)}
          onSave={(input) => onSave(tag.id, input)}
          onMerge={(targetId) => onMerge(tag.id, targetId)}
        />
      ))}
    </List>
  );
}
