import { parseResponse } from "@hono/hono/client";
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";
import type { LibraryFilters } from "../model/library-search.ts";
import { selectResourcePage } from "./resources.select.ts";

export const resourceQueryKeys = {
  root: ["resources"] as const,
  lists: ["resources", "list"] as const,
  detail: (id: string) => ["resources", "detail", id] as const,
  list: (
    filters: Record<string, string | number | boolean | undefined>,
  ) => ["resources", "list", filters] as const,
};

export const resourcesStaleTime = 5 * 60 * 1_000;
export const RESOURCE_PAGE_SIZE = 25;

export function resourceListQueryOptions(filters: LibraryFilters) {
  return queryOptions({
    queryKey: resourceQueryKeys.list({ ...filters }),
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.resources.$get({
          query: {
            search: filters.q,
            state: filters.state,
            visibility: filters.visibility,
            domain: filters.domain,
            enrichmentStatus: filters.enrichmentStatus,
            sort: filters.sort,
            limit: String(RESOURCE_PAGE_SIZE),
            offset: String((filters.page - 1) * RESOURCE_PAGE_SIZE),
          },
        }, { init: { signal } }),
      ),
    select: selectResourcePage,
    staleTime: resourcesStaleTime,
  });
}

export function resourceQueryOptions(id: string, enabled = true) {
  return queryOptions({
    queryKey: resourceQueryKeys.detail(id),
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.resources[":id"].$get(
          { param: { id } },
          { init: { signal } },
        ),
      ),
    select: ({ data }) => data,
    enabled,
    staleTime: resourcesStaleTime,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
}
