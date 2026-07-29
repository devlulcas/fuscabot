import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { InlineNotice } from "../../components/page-status/page-status.tsx";
import { PageStack } from "../../components/layout/page-stack.tsx";
import { resourceListQueryOptions } from "./api/resources.queries.ts";
import { useLibraryMutations } from "./api/resources.mutations.ts";
import { LibraryPagination } from "./components/library-pagination.tsx";
import { LibraryResourceList } from "./components/library-resource-list.tsx";
import { LibrarySearchForm } from "./components/library-search-form.tsx";
import { LibraryToolbar } from "./components/library-toolbar.tsx";
import { useLibrarySearch } from "./hooks/use-library-search.ts";
import { useLibrarySelection } from "./hooks/use-library-selection.ts";

export function LibraryRoute() {
  const search = useLibrarySearch();
  const selection = useLibrarySelection(search.scope);
  const resources = useQuery(resourceListQueryOptions(search.filters));
  const bulk = useLibraryMutations(selection.clearSelection);
  const items = resources.data?.items ?? [];
  const allSelected = items.length > 0 &&
    items.every((item) => selection.selected.has(item.id));
  const hasFilters = Boolean(
    search.filters.q || search.filters.state || search.filters.visibility ||
      search.filters.domain || search.filters.enrichmentStatus,
  );
  const submit = useCallback((form: HTMLFormElement) => {
    search.submit(form);
    selection.clearSelection();
  }, [search, selection]);
  const runBulkDelete = useCallback(() => {
    const ids = [...selection.selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Permanently delete ${ids.length} selected resource${
          ids.length === 1 ? "" : "s"
        }? This cannot be undone.`,
      )
    ) return;
    bulk.mutate({ ids, action: "delete" });
  }, [bulk, selection.selected]);
  return (
    <PageStack>
      <h1>Library</h1>
      <LibrarySearchForm
        filters={search.filters}
        formKey={search.params.toString()}
        onSubmit={submit}
      />
      <LibraryToolbar
        count={selection.selected.size}
        allSelected={allSelected}
        disabled={bulk.isPending}
        onSelectAll={(checked) =>
          selection.replaceSelection(
            checked ? new Set(items.map((item) => item.id)) : new Set(),
          )}
        onDelete={runBulkDelete}
      />
      {bulk.error
        ? <InlineNotice error>{bulk.error.message}</InlineNotice>
        : null}
      {resources.isRefetchError && resources.data
        ? (
          <InlineNotice error>
            Couldn’t refresh this page. Showing saved data.
          </InlineNotice>
        )
        : null}
      <LibraryResourceList
        resources={resources}
        selected={selection.selected}
        disabled={bulk.isPending}
        hasFilters={hasFilters}
        onToggle={selection.toggle}
      />
      <LibraryPagination
        currentPage={search.filters.page}
        hasMore={resources.data?.pageInfo.hasMore ?? false}
        onPageChange={search.goToPage}
      />
    </PageStack>
  );
}
