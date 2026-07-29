import { queryOptions } from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";
import type { LibraryFilters } from "../model/library-search.ts";

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
      api.listResources(filters.q, {
        state: filters.state,
        visibility: filters.visibility,
        domain: filters.domain,
        enrichmentStatus: filters.enrichmentStatus,
        sort: filters.sort,
        limit: RESOURCE_PAGE_SIZE,
        offset: (filters.page - 1) * RESOURCE_PAGE_SIZE,
        signal,
      }),
    staleTime: resourcesStaleTime,
  });
}

export function resourceQueryOptions(id: string, enabled = true) {
  return queryOptions({
    queryKey: resourceQueryKeys.detail(id),
    queryFn: ({ signal }) => api.getResource(id, signal),
    enabled,
    staleTime: resourcesStaleTime,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
}
