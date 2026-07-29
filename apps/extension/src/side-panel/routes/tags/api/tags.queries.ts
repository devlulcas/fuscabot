import { queryOptions } from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";

export const tagQueryKeys = {
  root: ["tags"] as const,
  list: (search = "") => ["tags", { search }] as const,
};

export const tagsStaleTime = 30 * 60 * 1_000;

export function tagsQueryOptions(search = "") {
  return queryOptions({
    queryKey: tagQueryKeys.list(search),
    queryFn: ({ signal }) => api.tags(search, signal),
    staleTime: tagsStaleTime,
  });
}
