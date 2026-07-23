import { assertEquals, assertMatch, assertNotEquals } from "@std/assert";
import { PublicationResultSchema } from "@fuscabot/contracts";
import { InMemoryResourceRepository } from "../src/repositories/resource_repository.ts";
import { RuntimePublicationCoordinator } from "../src/services/publication_coordinator.ts";
import { ResourceService } from "../src/services/resource_service.ts";

const ownerId = "discord-owner";
const resourceId = "019432f0-7c00-7000-8000-000000000001";
const channelId = "019432f0-7c00-7000-8000-000000000002";

async function fixture() {
  const resources = new ResourceService(
    new InMemoryResourceRepository("https://archive.example"),
  );
  await resources.capture({
    captureId: resourceId,
    url: "https://example.com/article?utm_source=test",
    title: "A Useful Árticle",
    selectedQuote: "Public excerpt",
    linkText: null,
    outputLanguage: "en",
    metadata: {
      canonicalUrl: null,
      description: "Private description",
      siteName: null,
      author: null,
      publishedAt: null,
      imageUrl: null,
      sourceLanguage: null,
    },
  });
  await resources.patch(resourceId, { personalNote: "Private note" });
  return resources;
}

Deno.test("website publication is idempotent and republishing retains its slug", async () => {
  const resources = await fixture();
  const coordinator = new RuntimePublicationCoordinator(ownerId, resources);
  const first = await coordinator.publish(ownerId, resourceId);
  PublicationResultSchema.parse(first);
  assertEquals(first.website.status, "published");
  assertEquals(first.discord.status, "not_requested");
  assertMatch(first.website.url!, /\/en\/links\/a-useful-article-[a-f0-9]{8}$/);

  const duplicate = await coordinator.publish(ownerId, resourceId);
  assertEquals(duplicate.website.status, "already_published");
  assertEquals(duplicate.website.url, first.website.url);

  await coordinator.unpublish(ownerId, resourceId);
  assertEquals((await resources.get(resourceId))!.publicPublication, null);
  const republished = await coordinator.publish(ownerId, resourceId);
  assertEquals(republished.website.status, "published");
  assertEquals(republished.website.url, first.website.url);
  assertNotEquals(
    (await resources.get(resourceId))!.publicPublication?.publishedAt,
    null,
  );
});

Deno.test("website succeeds independently when Discord delivery fails", async () => {
  const resources = await fixture();
  const coordinator = new RuntimePublicationCoordinator(ownerId, resources, {
    list: () => Promise.resolve([]),
    publish: () => Promise.reject(new Error("token and private URL must stay hidden")),
    retry: () => Promise.resolve({}),
  });
  const result = await coordinator.publish(ownerId, resourceId, channelId);
  assertEquals(result.website.status, "published");
  assertEquals(result.discord, {
    status: "failed",
    retryable: true,
    url: null,
    deliveryId: null,
    error: "Discord delivery failed",
  });
});

Deno.test("successful Discord destination is not delivered twice", async () => {
  const resources = await fixture();
  let publishes = 0;
  const coordinator = new RuntimePublicationCoordinator(ownerId, resources, {
    list: () =>
      Promise.resolve([{
        id: "019432f0-7c00-7000-8000-000000000003",
        channelId,
        kind: "share",
        status: "sent",
        externalUrl: "https://discord.com/channels/1/2/3",
      }]),
    publish: () => {
      publishes++;
      return Promise.resolve({});
    },
    retry: () => Promise.resolve({}),
  });
  const result = await coordinator.publish(ownerId, resourceId, channelId);
  assertEquals(result.discord.status, "already_sent");
  assertEquals(publishes, 0);
});
