import {
  mutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";
import { tagQueryKeys } from "./tags.queries.ts";
import type { TagInput } from "../model/tag-types.ts";
import { resourceQueryKeys } from "../../library/api/resources.queries.ts";

export function createTagMutationOptions() {
  return mutationOptions({
    mutationFn: api.createTag,
  });
}

export function updateTagMutationOptions() {
  return mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: TagInput }) =>
      api.updateTag(id, input),
  });
}

export function mergeTagMutationOptions() {
  return mutationOptions({
    mutationFn: (
      { sourceId, targetId }: { sourceId: string; targetId: string },
    ) => api.mergeTag(sourceId, targetId),
  });
}

export function useTagMutations(clearDirty: (key: string) => void) {
  const queryClient = useQueryClient();
  const invalidateTagsAndResources = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tagQueryKeys.root }),
      queryClient.invalidateQueries({ queryKey: resourceQueryKeys.root }),
    ]);
  };
  const create = useMutation({
    ...createTagMutationOptions(),
    onSuccess: async () => {
      await invalidateTagsAndResources();
      clearDirty("create");
    },
  });
  const update = useMutation({
    ...updateTagMutationOptions(),
    onSuccess: async (_updated, variables) => {
      await invalidateTagsAndResources();
      clearDirty(variables.id);
    },
  });
  const merge = useMutation({
    ...mergeTagMutationOptions(),
    onSuccess: async (_merged, variables) => {
      await invalidateTagsAndResources();
      clearDirty(variables.sourceId);
    },
  });
  return {
    create,
    update,
    merge,
  };
}
