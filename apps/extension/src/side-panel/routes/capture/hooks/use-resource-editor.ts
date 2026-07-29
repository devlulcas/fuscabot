import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "@hono/hono/client";
import { createElement, type ReactNode, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../../../shared/hono-client.ts";
import { safeDiscordMessageUrl } from "../../../../shared/ui_security.ts";
import { channelsQueryOptions } from "../../channels/api/channels.queries.ts";
import { tagsQueryOptions } from "../../tags/api/tags.queries.ts";
import {
  resourceQueryKeys,
  resourceQueryOptions,
} from "../../library/api/resources.queries.ts";
import {
  deleteResourceMutationOptions,
  publishResourceMutationOptions,
  readLaterMutationOptions,
  retryDiscordMutationOptions,
  retryEnrichmentMutationOptions,
  retryWebsiteMutationOptions,
  saveResourceMutationOptions,
  unpublishMutationOptions,
} from "../api/captures.mutations.ts";
import { canPublish, resolveDestination } from "../model/capture-policy.ts";
import type { ResourcePatch } from "../model/capture-types.ts";
import type { PublicationResult } from "../api/captures.select.ts";

export function useResourceEditor(resourceId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const resource = useQuery(resourceQueryOptions(resourceId));
  const channels = useQuery(channelsQueryOptions());
  const tags = useQuery(tagsQueryOptions());
  const [dirtyStatus, setDirtyStatus] = useState<string | null>(null);
  const [channelSelection, setChannelSelection] = useState({
    enrichmentStatus: "",
    channelId: "",
  });
  const [notice, setNotice] = useState<ReactNode>();
  const [publicationResult, setPublicationResult] = useState<
    PublicationResult | null
  >(null);
  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: resourceQueryKeys.detail(resourceId),
      }),
      queryClient.invalidateQueries({ queryKey: resourceQueryKeys.lists }),
    ]);
  }, [queryClient, resourceId]);
  const persistDraft = useCallback(async (patch: ResourcePatch) => {
    const updated = (await parseResponse(
      apiClient.v1.resources[":id"].$patch({
        param: { id: resourceId },
        json: patch,
      }),
    )).data;
    queryClient.setQueryData(resourceQueryKeys.detail(resourceId), updated);
    await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.lists });
    setDirtyStatus(null);
    return updated;
  }, [queryClient, resourceId]);
  const save = useMutation(saveResourceMutationOptions(persistDraft));
  const retry = useMutation(retryEnrichmentMutationOptions(resourceId));
  const publish = useMutation(
    publishResourceMutationOptions(resourceId, persistDraft),
  );
  const readLater = useMutation(
    readLaterMutationOptions(resourceId, persistDraft),
  );
  const unpublish = useMutation(unpublishMutationOptions(resourceId));
  const retryWebsite = useMutation(retryWebsiteMutationOptions(resourceId));
  const retryDiscord = useMutation(retryDiscordMutationOptions());
  const remove = useMutation(deleteResourceMutationOptions(resourceId));
  const saveDraft = useCallback(
    (patch: ResourcePatch) =>
      save.mutate(patch, { onSuccess: () => setNotice("Saved.") }),
    [save],
  );
  const retryAi = useCallback(
    () =>
      retry.mutate(undefined, {
        onSuccess: async (result) => {
          await invalidate();
          if (result.status === "ready") {
            setNotice("AI fields updated. Review them before publishing.");
          }
        },
      }),
    [invalidate, retry],
  );
  const publishDraft = useCallback(
    (destination: string, patch: ResourcePatch) =>
      publish.mutate({ destination, patch }, {
        onSuccess: async (result) => {
          await invalidate();
          setPublicationResult(result);
        },
      }),
    [invalidate, publish],
  );
  const sendToReadLater = useCallback(
    (patch: ResourcePatch) =>
      readLater.mutate(patch, {
        onSuccess: async () => {
          await invalidate();
          setNotice("Sent to Read Later.");
        },
      }),
    [invalidate, readLater],
  );
  const removeFromPublic = useCallback(
    () =>
      unpublish.mutate(undefined, {
        onSuccess: async () => {
          await invalidate();
          setNotice("Removed from the public site.");
        },
      }),
    [invalidate, unpublish],
  );
  const retryPublicWebsite = useCallback(
    () =>
      retryWebsite.mutate(undefined, {
        onSuccess: async (result) => {
          await invalidate();
          setPublicationResult(result);
        },
      }),
    [invalidate, retryWebsite],
  );
  const retryPublicDiscord = useCallback(
    (deliveryId: string) =>
      retryDiscord.mutate(deliveryId, {
        onSuccess: async (delivery) => {
          await invalidate();
          const url = safeDiscordMessageUrl(delivery.discordUrl);
          setNotice([
            "Discord delivery sent. ",
            url
              ? createElement(
                "a",
                { href: url, target: "_blank", rel: "noopener noreferrer" },
                "Open in Discord",
              )
              : null,
          ]);
          setPublicationResult(null);
        },
      }),
    [invalidate, retryDiscord],
  );
  const deleteResource = useCallback(
    () =>
      remove.mutate(undefined, {
        onSuccess: async () => {
          queryClient.removeQueries({
            queryKey: resourceQueryKeys.detail(resourceId),
          });
          await queryClient.invalidateQueries({
            queryKey: resourceQueryKeys.lists,
          });
          navigate("/library");
        },
      }),
    [navigate, queryClient, remove, resourceId],
  );
  const item = resource.data;
  const availableChannels =
    channels.data?.filter((channel) =>
      channel.isActiveForRouting && channel.availability === "available"
    ) ?? [];
  const suggestion = item?.enrichment?.draft?.channelSuggestion;
  const destination = item
    ? resolveDestination({
      enrichmentStatus: item.enrichmentStatus,
      selectionStatus: channelSelection.enrichmentStatus,
      selectedChannelId: channelSelection.channelId,
      suggestedChannelId: suggestion?.channelId,
      availableChannelIds: new Set(
        availableChannels.map((channel) => channel.id),
      ),
    })
    : "";
  const busy = save.isPending || publish.isPending || readLater.isPending ||
    unpublish.isPending || retryWebsite.isPending || retryDiscord.isPending ||
    remove.isPending;
  return {
    resource,
    channels,
    tags,
    item,
    destination,
    availableChannels,
    notice,
    publicationResult,
    dirty: dirtyStatus === item?.enrichmentStatus,
    busy,
    publishable: item ? canPublish(item.enrichmentStatus) : false,
    mutations: {
      save,
      retry,
      publish,
      readLater,
      unpublish,
      retryWebsite,
      retryDiscord,
      remove,
    },
    setDirty: () => setDirtyStatus(item?.enrichmentStatus ?? null),
    setChannel: (channelId: string) => {
      setChannelSelection({
        enrichmentStatus: item?.enrichmentStatus ?? "",
        channelId,
      });
      setDirtyStatus(item?.enrichmentStatus ?? null);
    },
    saveDraft,
    retryAi,
    publishDraft,
    sendToReadLater,
    removeFromPublic,
    retryPublicWebsite,
    retryPublicDiscord,
    deleteResource,
  };
}
