import type { UseQueryResult } from "@tanstack/react-query";
import type { ResourcePage } from "../../../../shared/api.ts";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../../components/page-status/page-status.tsx";
import { List } from "../../../components/list/list.tsx";
import { LibraryResourceItem } from "./library-resource-item.tsx";

export function LibraryResourceList({
  resources,
  selected,
  disabled,
  hasFilters,
  onToggle,
}: {
  resources: UseQueryResult<ResourcePage, Error>;
  selected: Set<string>;
  disabled: boolean;
  hasFilters: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  if (resources.isPending) return <PageLoading label="Loading resources…" />;
  if (resources.isError) {
    return (
      <PageError
        error={resources.error}
        retry={() => void resources.refetch()}
      />
    );
  }
  if (!resources.data.items.length) {
    return (
      <InlineNotice>
        {hasFilters
          ? "No resources match these filters."
          : "No resources found. Capture a page to start your library."}
      </InlineNotice>
    );
  }
  return (
    <List>
      {resources.data.items.map((resource) => (
        <LibraryResourceItem
          key={resource.id}
          resource={resource}
          selected={selected.has(resource.id)}
          disabled={disabled}
          onToggle={(checked) => onToggle(resource.id, checked)}
        />
      ))}
    </List>
  );
}
