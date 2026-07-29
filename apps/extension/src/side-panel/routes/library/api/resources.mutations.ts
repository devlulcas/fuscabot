import { parseResponse } from "@hono/hono/client";
import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";
import { resourceQueryKeys } from "./resources.queries.ts";

export type BulkResourceInput = { ids: string[]; action: "delete" };

export function bulkResourcesMutationOptions(
  queryClient: QueryClient,
  clearSelection: () => void,
) {
  return mutationOptions({
    mutationFn: async ({ ids, action }: BulkResourceInput) =>
      (await parseResponse(
        apiClient.v1.resources["bulk-actions"].$post({
          json: { ids, action },
        }),
      )).data,
    onSuccess: async (result) => {
      if (result.action === "delete") {
        for (const id of result.affectedIds) {
          queryClient.removeQueries({ queryKey: resourceQueryKeys.detail(id) });
        }
      }
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.root });
      clearSelection();
    },
  });
}

export function useLibraryMutations(clearSelection: () => void) {
  const queryClient = useQueryClient();
  return useMutation(
    bulkResourcesMutationOptions(queryClient, clearSelection),
  );
}
