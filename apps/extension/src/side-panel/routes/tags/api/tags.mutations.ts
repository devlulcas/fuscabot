import { parseResponse } from "@hono/hono/client";
import {
  mutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";
import { tagQueryKeys } from "./tags.queries.ts";
import type { TagInput } from "../model/tag-types.ts";
import { resourceQueryKeys } from "../../library/api/resources.queries.ts";

export function createTagMutationOptions() {
  return mutationOptions({
    mutationFn: async (input: TagInput) =>
      (await parseResponse(apiClient.v1.tags.$post({ json: input }))).data,
  });
}

export function updateTagMutationOptions() {
  return mutationOptions({
    mutationFn: async ({ id, input }: { id: string; input: TagInput }) =>
      (await parseResponse(
        apiClient.v1.tags[":id"].$patch({
          param: { id },
          json: input,
        }),
      )).data,
  });
}

export function mergeTagMutationOptions() {
  return mutationOptions({
    mutationFn: (
      { sourceId, targetId }: { sourceId: string; targetId: string },
    ) =>
      parseResponse(
        apiClient.v1.tags[":id"].merge.$post({
          param: { id: sourceId },
          json: { targetId },
        }),
      ).then(({ data }) => data),
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
