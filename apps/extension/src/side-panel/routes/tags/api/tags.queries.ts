import { parseResponse } from "@hono/hono/client";
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";

export const tagQueryKeys = {
  root: ["tags"] as const,
  list: (search = "") => ["tags", { search }] as const,
};

export const tagsStaleTime = 30 * 60 * 1_000;

export function tagsQueryOptions(search = "") {
  return queryOptions({
    queryKey: tagQueryKeys.list(search),
    queryFn: ({ signal }) =>
      parseResponse(
        apiClient.v1.tags.$get(
          { query: { search } },
          { init: { signal } },
        ),
      ),
    select: ({ data }) => data,
    staleTime: tagsStaleTime,
  });
}
