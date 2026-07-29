import { mutationOptions } from "@tanstack/react-query";
import { api } from "../../../../shared/api.ts";
import { savePendingCapture } from "../../../../shared/pending-capture.ts";
import type { CapturePayload } from "../../../../shared/types.ts";
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
      const resource = await api.createCapture(payload);
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
  return mutationOptions({ mutationFn: () => api.retryEnrichment(resourceId) });
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
        () => api.publish(resourceId, destination || undefined),
      ),
  });
}

export function readLaterMutationOptions(
  resourceId: string,
  persistDraft: (patch: ResourcePatch) => Promise<unknown>,
) {
  return mutationOptions({
    mutationFn: (patch: ResourcePatch) =>
      saveBeforeDelivery(patch, persistDraft, () => api.readLater(resourceId)),
  });
}

export function unpublishMutationOptions(resourceId: string) {
  return mutationOptions({ mutationFn: () => api.unpublish(resourceId) });
}

export function retryWebsiteMutationOptions(resourceId: string) {
  return mutationOptions({ mutationFn: () => api.publish(resourceId) });
}

export function retryDiscordMutationOptions() {
  return mutationOptions({
    mutationFn: (deliveryId: string) => api.retryDelivery(deliveryId),
  });
}

export function deleteResourceMutationOptions(resourceId: string) {
  return mutationOptions({ mutationFn: () => api.deleteResource(resourceId) });
}

function value(form: FormData, name: string): string {
  const entry = form.get(name);
  return typeof entry === "string" ? entry : "";
}

function optionalValue(form: FormData, name: string): string | null {
  return value(form, name).trim() || null;
}
