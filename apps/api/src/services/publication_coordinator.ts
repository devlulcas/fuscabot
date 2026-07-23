import type { PublicationResult } from "@fuscabot/contracts";
import type { DeliveryCoordinator } from "../app.ts";
import { ResourceNotFoundError, type ResourceService } from "./resource_service.ts";

type DeliveryView = {
  id?: string;
  channelId?: string;
  kind?: string;
  deliveryKind?: string;
  status?: string;
  externalUrl?: string | null;
};

export interface PublicationCoordinator {
  publish(ownerId: string, resourceId: string, channelId?: string): Promise<PublicationResult>;
  unpublish(ownerId: string, resourceId: string): Promise<unknown>;
}

export class RuntimePublicationCoordinator implements PublicationCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly resources: ResourceService,
    private readonly deliveries?: DeliveryCoordinator,
  ) {}

  async publish(
    ownerId: string,
    resourceId: string,
    channelId?: string,
  ): Promise<PublicationResult> {
    assertOwner(ownerId, this.ownerId);
    if (!await this.resources.get(resourceId)) {
      throw new ResourceNotFoundError();
    }
    const result: PublicationResult = {
      website: emptyTarget("failed"),
      discord: emptyTarget(channelId ? "failed" : "not_requested"),
    };
    try {
      const published = await this.resources.publish(resourceId);
      result.website = {
        status: published.created ? "published" : "already_published",
        retryable: false,
        url: published.resource.publicPublication!.url,
        deliveryId: null,
        error: null,
      };
    } catch (cause) {
      result.website = {
        ...emptyTarget("failed"),
        retryable: true,
        error: sanitizedError(cause, "Website publication failed"),
      };
    }

    if (!channelId) return result;
    if (!this.deliveries) {
      result.discord = {
        ...emptyTarget("unavailable"),
        error: "Discord delivery is unavailable",
      };
      return result;
    }
    try {
      const history = await this.deliveries.list(ownerId, resourceId) as DeliveryView[];
      const sent = history.find((delivery) =>
        delivery.channelId === channelId &&
        (delivery.kind === "share" || delivery.deliveryKind === "share") &&
        delivery.status === "sent"
      );
      if (sent) {
        result.discord = {
          status: "already_sent",
          retryable: false,
          url: sent.externalUrl ?? null,
          deliveryId: sent.id ?? null,
          error: null,
        };
        return result;
      }
      const delivery = await this.deliveries.publish(ownerId, resourceId, {
        channelId,
        kind: "share",
      }) as DeliveryView;
      result.discord = {
        status: "sent",
        retryable: false,
        url: delivery.externalUrl ?? null,
        deliveryId: delivery.id ?? null,
        error: null,
      };
    } catch (cause) {
      const sent = await this.findSent(ownerId, resourceId, channelId).catch(() => null);
      if (sent) {
        result.discord = {
          status: "already_sent",
          retryable: false,
          url: sent.externalUrl ?? null,
          deliveryId: sent.id ?? null,
          error: null,
        };
        return result;
      }
      result.discord = {
        ...emptyTarget("failed"),
        retryable: true,
        error: sanitizedError(cause, "Discord delivery failed"),
      };
    }
    return result;
  }

  private async findSent(ownerId: string, resourceId: string, channelId: string) {
    if (!this.deliveries) return null;
    const history = await this.deliveries.list(ownerId, resourceId) as DeliveryView[];
    return history.find((delivery) =>
      delivery.channelId === channelId &&
      (delivery.kind === "share" || delivery.deliveryKind === "share") &&
      delivery.status === "sent"
    ) ?? null;
  }

  async unpublish(ownerId: string, resourceId: string) {
    assertOwner(ownerId, this.ownerId);
    return await this.resources.unpublish(resourceId);
  }
}

function emptyTarget(status: PublicationResult["website"]["status"]) {
  return { status, retryable: false, url: null, deliveryId: null, error: null };
}

function sanitizedError(cause: unknown, fallback: string): string {
  if (
    cause instanceof Error &&
    (cause.name === "PublicationEligibilityError" || cause.name === "ResourceNotFoundError")
  ) return cause.message.slice(0, 200);
  return fallback;
}

function assertOwner(actual: string, expected: string): void {
  if (actual !== expected) throw new Error("Workspace access denied");
}
