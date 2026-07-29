import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";
import { resourceQueryKeys } from "./resources.queries.ts";

export type BulkResourceInput = { ids: string[]; action: "delete" };

export function bulkResourcesMutationOptions(
  queryClient: QueryClient,
  clearSelection: () => void,
) {
  return mutationOptions({
    mutationFn: ({ ids, action }: BulkResourceInput) =>
      api.bulkResources(ids, action),
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
