import { assertEquals, assertRejects } from "@std/assert";
import type { DeliverySnapshot, Resource } from "@fuscabot/contracts";
import type { StoredChannel } from "../src/domain/discord_setup.ts";
import type { ResourceRepository } from "../src/repositories/resource_repository.ts";
import type { DiscordSetupCoordinator } from "../src/services/discord_setup_coordinator.ts";
import type { DurableDeliveryCoordinator } from "../src/services/durable_delivery_coordinator.ts";
import {
  RuntimeDeliveryCoordinator,
  RuntimeEnrichmentCoordinator,
} from "../src/services/runtime_coordinators.ts";
import { EnrichmentPreparingError } from "../src/domain/durable_delivery.ts";
import type { EnrichmentInput } from "../src/domain/enrichment.ts";
import type { EnrichmentService } from "../src/services/enrichment_service.ts";

const resource: Resource & { workspaceId: string } = {
  id: "019432f0-7c00-7000-8000-000000000001",
  workspaceId: "019432f0-7c00-7000-8000-000000000002",
  originalUrl: "https://example.com/post",
  normalizedUrl: "https://example.com/post",
  canonicalUrl: null,
  canonicalUrlKey: "https://example.com/post",
  sourceDomain: "example.com",
  sourceLanguage: "en",
  outputLanguage: "en",
  title: "Post",
  description: null,
  siteName: null,
  author: null,
  publishedAtSource: null,
  imageUrl: null,
  selectedQuote: "Selected",
  summary: "Summary",
  personalNote: "Note",
  enrichmentStatus: "ready",
  enrichmentError: null,
  publicPublication: null,
  tags: [{
    slug: "typescript",
    labels: [{ language: "en", name: "TypeScript" }],
    aliases: [],
    source: "user",
  }],
  createdAt: "2026-07-21T12:00:00Z",
  updatedAt: "2026-07-21T12:00:00Z",
};

Deno.test("runtime delivery snapshots explicit and Read Later channel names", async () => {
  const channel: StoredChannel = {
    id: "019432f0-7c00-7000-8000-000000000003",
    workspaceId: resource.workspaceId,
    discordChannelId: "discord-channel",
    name: "saved-links",
    parentDiscordChannelId: null,
    parentName: null,
    topic: null,
    routingDescription: null,
    isActiveForRouting: true,
    isReadLater: true,
    availability: "available",
  };
  const captured: DeliverySnapshot[] = [];
  const resources = {
    findById: () => Promise.resolve(resource),
  } as unknown as ResourceRepository;
  const setup = {
    list: () => Promise.resolve([channel]),
  } as unknown as DiscordSetupCoordinator;
  const delivery = {
    publish: (
      _workspaceId: string,
      _resourceId: string,
      _channelId: string,
      _kind: string,
      snapshot: DeliverySnapshot,
    ) => {
      captured.push(structuredClone(snapshot));
      return Promise.resolve(snapshot);
    },
  } as unknown as DurableDeliveryCoordinator;
  const coordinator = new RuntimeDeliveryCoordinator(
    "owner",
    resource.workspaceId,
    resources,
    setup,
    delivery,
  );

  await coordinator.publish("owner", resource.id, { channelId: channel.id, kind: "share" });
  channel.name = "renamed-after-send";
  await coordinator.publish("owner", resource.id, { kind: "read_later" });

  assertEquals("version" in captured[0] && captured[0].destinationLabel, "#saved-links");
  assertEquals("version" in captured[1] && captured[1].destinationLabel, "#renamed-after-send");
  assertEquals("version" in captured[1] && captured[1].tags, ["typescript"]);
});

Deno.test("runtime delivery rejects resources still waiting for manual AI auto-fill", async () => {
  const resources = {
    findById: () => Promise.resolve({ ...resource, enrichmentStatus: "preparing" }),
  } as unknown as ResourceRepository;
  const coordinator = new RuntimeDeliveryCoordinator(
    "owner",
    resource.workspaceId,
    resources,
    { list: () => Promise.resolve([]) } as unknown as DiscordSetupCoordinator,
    {} as DurableDeliveryCoordinator,
  );

  await assertRejects(
    () =>
      coordinator.publish("owner", resource.id, { channelId: crypto.randomUUID(), kind: "share" }),
    EnrichmentPreparingError,
  );
});

Deno.test("manual AI retry starts the first enrichment run with current resource data", async () => {
  let captured: { resourceId: string; input?: EnrichmentInput } | undefined;
  const enrichment = {
    prepare: (resourceId: string, input?: EnrichmentInput) => {
      captured = { resourceId, input };
      return Promise.resolve({ status: "ready" });
    },
  } as unknown as EnrichmentService;
  const coordinator = new RuntimeEnrichmentCoordinator(
    "owner",
    resource.workspaceId,
    { findById: () => Promise.resolve(resource) } as unknown as ResourceRepository,
    { list: () => Promise.resolve([]) } as unknown as DiscordSetupCoordinator,
    enrichment,
  );

  await coordinator.retry("owner", resource.id);

  assertEquals(captured?.resourceId, resource.id);
  assertEquals(captured?.input?.title, resource.title);
  assertEquals(captured?.input?.selectedQuote, resource.selectedQuote);
});
