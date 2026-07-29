import { parseResponse } from "@hono/hono/client";
import { mutationOptions } from "@tanstack/react-query";
import { apiClient } from "../../../../shared/hono-client.ts";
import { savePendingCapture } from "../../../../shared/pending-capture.ts";
import type { CapturePayload } from "../../../../shared/types.ts";
import { selectDelivery } from "./captures.select.ts";
import { saveBeforeDelivery } from "../model/capture-policy.ts";
import type { ResourcePatch } from "../model/capture-types.ts";

export function createManualCaptureMutationOptions() {
  return mutationOptions({
    mutationFn: async (form: FormData) => {
      const captureId = crypto.randomUUID();
      const payload: CapturePayload = {
        captureId,
        url: value(form, "url"),
        title: value(form, "title"),
        selectedQuote: optionalValue(form, "selectedQuote"),
        linkText: null,
        outputLanguage: "pt-BR",
        metadata: {
          canonicalUrl: null,
          description: null,
          siteName: null,
          author: null,
          publishedAt: null,
          imageUrl: null,
          sourceLanguage: null,
        },
      };
      const resource = (await parseResponse(
        apiClient.v1.resources.captures.$post({ json: payload }),
      )).data;
      await savePendingCapture({
        captureId,
        resourceId: resource.id,
        state: "ready",
      });
      return captureId;
    },
  });
}

export function saveResourceMutationOptions(
  persistDraft: (patch: ResourcePatch) => Promise<unknown>,
) {
  return mutationOptions({ mutationFn: persistDraft });
}

export function retryEnrichmentMutationOptions(resourceId: string) {
  return mutationOptions({
    mutationFn: async () =>
      (await parseResponse(
        apiClient.v1.resources[":id"].enrichment.retry.$post({
          param: { id: resourceId },
        }),
      )).data,
  });
}

export function publishResourceMutationOptions(
  resourceId: string,
  persistDraft: (patch: ResourcePatch) => Promise<unknown>,
) {
  return mutationOptions({
    mutationFn: (
      { destination, patch }: { destination: string; patch: ResourcePatch },
    ) =>
      saveBeforeDelivery(
        patch,
        persistDraft,
        async () =>
          (await parseResponse(
            apiClient.v1.resources[":id"].publication.$post({
              param: { id: resourceId },
              json: destination ? { channelId: destination } : {},
            }),
          )).data,
      ),
  });
}

export function readLaterMutationOptions(
  resourceId: string,
  persistDraft: (patch: ResourcePatch) => Promise<unknown>,
) {
  return mutationOptions({
    mutationFn: (patch: ResourcePatch) =>
      saveBeforeDelivery(
        patch,
        persistDraft,
        async () =>
          selectDelivery(
            await parseResponse(
              apiClient.v1.resources[":id"].deliveries["read-later"].$post({
                param: { id: resourceId },
              }),
            ),
          ),
      ),
  });
}

export function unpublishMutationOptions(resourceId: string) {
  return mutationOptions({
    mutationFn: async () =>
      (await parseResponse(
        apiClient.v1.resources[":id"].publication.$delete({
          param: { id: resourceId },
        }),
      )).data,
  });
}

export function retryWebsiteMutationOptions(resourceId: string) {
  return mutationOptions({
    mutationFn: async () =>
      (await parseResponse(
        apiClient.v1.resources[":id"].publication.$post({
          param: { id: resourceId },
          json: {},
        }),
      )).data,
  });
}

export function retryDiscordMutationOptions() {
  return mutationOptions({
    mutationFn: async (deliveryId: string) =>
      selectDelivery(
        await parseResponse(
          apiClient.v1.deliveries[":id"].retry.$post({
            param: { id: deliveryId },
          }),
        ),
      ),
  });
}

export function deleteResourceMutationOptions(resourceId: string) {
  return mutationOptions({
    mutationFn: async () => {
      await parseResponse(
        apiClient.v1.resources[":id"].$delete({ param: { id: resourceId } }),
      );
    },
  });
}

function value(form: FormData, name: string): string {
  const entry = form.get(name);
  return typeof entry === "string" ? entry : "";
}

function optionalValue(form: FormData, name: string): string | null {
  return value(form, name).trim() || null;
}
