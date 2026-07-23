import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../shared/api.ts";
import { safeWebUrl } from "../../../shared/ui_security.ts";
import {
  InlineNotice,
  PageError,
  PageLoading,
} from "../../components/page-status/page-status.tsx";
import page from "../../components/layout/page.module.css";
import { FIVE_MINUTES } from "../../data/queries.ts";
import { queryKeys } from "../../data/query-keys.ts";
import { librarySearchParams, parseLibrarySearch } from "./library-search.ts";

const PAGE_SIZE = 25;
const EMPTY_SELECTION = new Set<string>();

export function LibraryRoute() {
  const [params, setParams] = useSearchParams();
  const selectionScope = params.toString();
  const filters = parseLibrarySearch(params);
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{
    scope: string;
    ids: Set<string>;
  }>(() => ({ scope: selectionScope, ids: new Set() }));
  const selected = selection.scope === selectionScope
    ? selection.ids
    : EMPTY_SELECTION;
  const setSelected = (ids: Set<string>) =>
    setSelection({ scope: selectionScope, ids });
  const resources = useQuery({
    queryKey: queryKeys.resourceList({ ...filters }),
    queryFn: ({ signal }) =>
      api.listResources(filters.q, {
        state: filters.state,
        visibility: filters.visibility,
        domain: filters.domain,
        enrichmentStatus: filters.enrichmentStatus,
        sort: filters.sort,
        limit: PAGE_SIZE,
        offset: (filters.page - 1) * PAGE_SIZE,
        signal,
      }),
    staleTime: FIVE_MINUTES,
  });
  const bulk = useMutation({
    mutationFn: (
      { ids, action }: {
        ids: string[];
        action: "delete";
      },
    ) => api.bulkResources(ids, action),
    onSuccess: async (result) => {
      if (result.action === "delete") {
        for (const id of result.affectedIds) {
          queryClient.removeQueries({ queryKey: queryKeys.resource(id) });
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.resources });
      setSelected(new Set());
    },
  });
  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    setParams(librarySearchParams({
      q: stringValue(data, "q"),
      state: optionalEnum(data, "state", [
        "inbox",
        "read_later",
        "shared",
      ]),
      visibility: optionalEnum(data, "visibility", ["public", "private"]),
      domain: stringValue(data, "domain") || undefined,
      enrichmentStatus: optionalEnum(data, "enrichmentStatus", [
        "preparing",
        "ready",
        "failed",
      ]),
      sort: optionalEnum(data, "sort", ["newest", "oldest", "updated"]) ??
        "newest",
      page: 1,
    }));
    setSelected(new Set());
  };
  const items = resources.data?.items ?? [];
  const hasFilters = Boolean(
    filters.q || filters.state || filters.visibility || filters.domain ||
      filters.enrichmentStatus,
  );
  const allSelected = items.length > 0 &&
    items.every((item) => selected.has(item.id));
  const runBulkDelete = () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      !confirm(
        `Permanently delete ${ids.length} selected resource${
          ids.length === 1 ? "" : "s"
        }? This cannot be undone.`,
      )
    ) return;
    bulk.mutate({ ids, action: "delete" });
  };
  return (
    <section className={page.stack}>
      <h1>Library</h1>
      <form
        key={params.toString()}
        className={`${page.form} ${page.search}`}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
      >
        <label>
          Search<input
            name="q"
            type="search"
            defaultValue={filters.q}
            autoComplete="off"
            placeholder="Title, URL, note, tag…"
          />
        </label>
        <label>
          State<select name="state" defaultValue={filters.state ?? ""}>
            <option value="">All States</option>
            <option value="inbox">Inbox</option>
            <option value="read_later">Read Later</option>
            <option value="shared">Shared</option>
          </select>
        </label>
        <label>
          Visibility<select
            name="visibility"
            defaultValue={filters.visibility ?? ""}
          >
            <option value="">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label>
          Domain<input
            name="domain"
            defaultValue={filters.domain}
            autoComplete="off"
            placeholder="example.com…"
          />
        </label>
        <label>
          AI Status<select
            name="enrichmentStatus"
            defaultValue={filters.enrichmentStatus ?? ""}
          >
            <option value="">Any</option>
            <option value="failed">Failed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
          </select>
        </label>
        <label>
          Sort<select name="sort" defaultValue={filters.sort}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="updated">Recently Updated</option>
          </select>
        </label>
        <button type="submit" className={page.button}>Apply Filters</button>
      </form>
      <div className={`${page.card} ${page.toolbar}`}>
        <label className={page.row}>
          <input
            type="checkbox"
            aria-label="Select all resources on this page"
            checked={allSelected}
            disabled={!items.length || bulk.isPending}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? new Set(items.map((item) => item.id))
                  : new Set(),
              )}
          />{" "}
          Select All
        </label>
        <span className={page.muted}>{selected.size} selected</span>
        <div className={page.actions}>
          <button
            type="button"
            disabled={!selected.size || bulk.isPending}
            className={page.danger}
            onClick={runBulkDelete}
          >
            Delete Selected
          </button>
        </div>
      </div>
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
      {resources.isPending
        ? <PageLoading label="Loading resources…" />
        : resources.isError
        ? (
          <PageError
            error={resources.error}
            retry={() => void resources.refetch()}
          />
        )
        : items.length
        ? (
          <div className={page.list}>
            {items.map((resource) => (
              <article
                className={`${page.card} ${page.resource}`}
                key={resource.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${resource.title}`}
                  checked={selected.has(resource.id)}
                  disabled={bulk.isPending}
                  onChange={(event) =>
                    setSelected((() => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(resource.id);
                      else next.delete(resource.id);
                      return next;
                    })())}
                />
                <div className={page.resourceCopy}>
                  <div className={page.resourceTitle}>
                    <strong>{resource.title}</strong>
                    {resource.publicPublication
                      ? (
                        <span className={`${page.status} ${page.public}`}>
                          Public
                        </span>
                      )
                      : null}
                  </div>
                  <span className={`${page.muted} ${page.truncate}`}>
                    {safeWebUrl(resource.originalUrl)}
                  </span>
                </div>
                <div className={page.resourceActions}>
                  <a
                    href={safeWebUrl(resource.originalUrl) ?? "about:blank"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Source
                  </a>
                  <Link
                    className={`${page.buttonLink} ${page.compact}`}
                    to={`/capture/${resource.id}`}
                  >
                    Review
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )
        : (
          <InlineNotice>
            {hasFilters
              ? "No resources match these filters."
              : "No resources found. Capture a page to start your library."}
          </InlineNotice>
        )}
      <nav className={page.pagination} aria-label="Library pages">
        <button
          type="button"
          className={page.button}
          disabled={filters.page === 1}
          onClick={() =>
            setParams(
              librarySearchParams({ ...filters, page: filters.page - 1 }),
            )}
        >
          Previous
        </button>
        <span>Page {filters.page}</span>
        <button
          type="button"
          className={page.button}
          disabled={!resources.data?.pageInfo.hasMore}
          onClick={() =>
            setParams(
              librarySearchParams({ ...filters, page: filters.page + 1 }),
            )}
        >
          Next
        </button>
      </nav>
    </section>
  );
}

function stringValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function optionalEnum<T extends string>(
  data: FormData,
  name: string,
  values: readonly T[],
): T | undefined {
  const value = stringValue(data, name);
  return values.find((candidate) => candidate === value);
}
