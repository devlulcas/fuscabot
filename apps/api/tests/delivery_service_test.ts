import { assertEquals, assertRejects } from "@std/assert";
import type { CaptureInput } from "../src/domain/resource.ts";
import { InMemoryDeliveryRepository } from "../src/repositories/delivery_repository.ts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import { DeliveryFailedError, DeliveryService } from "../src/services/delivery_service.ts";
import { ResourceService } from "../src/services/resource_service.ts";

const capture: CaptureInput = {
  captureId: "019432f0-7c00-7000-8000-000000000001",
  url: "https://example.com/post",
  title: "Post",
  selectedQuote: null,
  linkText: null,
  outputLanguage: "pt-BR",
  metadata: {
    canonicalUrl: null,
    description: null,
    siteName: null,
    author: null,
    publishedAt: null,
    imageUrl: null,
    sourceLanguage: "en",
  },
};
const target = { channelId: crypto.randomUUID(), discordChannelId: "123", guildId: "456" };

Deno.test("delivery transitions pending to sent and deduplicates", async () => {
  const resources = new InMemoryResourceRepository();
  await new ResourceService(resources).capture(capture);
  const repository = new InMemoryDeliveryRepository();
  const service = new DeliveryService(resources, repository, {
    createChannelMessage: () => Promise.resolve({ id: "789", channel_id: "123" }),
  });
  const delivery = await service.publish(capture.captureId, target, "share");
  assertEquals(delivery.status, "sent");
  assertEquals(delivery.externalUrl, "https://discord.com/channels/456/123/789");
  await assertRejects(() => service.publish(capture.captureId, target, "share"));
});

Deno.test("failed Discord call persists a retryable failed record", async () => {
  const resources = new InMemoryResourceRepository();
  await new ResourceService(resources).capture(capture);
  const repository = new InMemoryDeliveryRepository();
  const service = new DeliveryService(resources, repository, {
    createChannelMessage: () => Promise.reject(new Error("upstream unavailable")),
  });
  const error = await assertRejects(
    () => service.publish(capture.captureId, target, "read_later"),
    DeliveryFailedError,
  );
  assertEquals(
    await repository.findActive(capture.captureId, target.channelId, "read_later"),
    null,
  );
  assertEquals(error.message, "upstream unavailable");
});
