import { assertEquals, assertRejects } from "@std/assert";
import { InvalidReadLaterChannelError, type StoredChannel } from "../src/domain/discord_setup.ts";
import { DiscordSetupCoordinator } from "../src/services/discord_setup_coordinator.ts";

const channel: StoredChannel = {
  id: "channel",
  workspaceId: "workspace",
  discordChannelId: "10",
  name: "read-later",
  parentDiscordChannelId: null,
  parentName: null,
  topic: null,
  routingDescription: "Keep for later",
  isActiveForRouting: true,
  isReadLater: true,
  availability: "available",
};
Deno.test("setup coordinator enforces an active Read Later channel", async () => {
  const calls: unknown[] = [];
  const coordinator = new DiscordSetupCoordinator({
    bootstrapOwner: () => Promise.resolve("workspace"),
    selectGuild: () => Promise.resolve(),
    syncChannels: () => Promise.resolve([channel]),
    listChannels: () => Promise.resolve([channel]),
    updateChannel: (_w, _c, patch) => {
      calls.push(patch);
      return Promise.resolve(channel);
    },
  });
  await assertRejects(
    () =>
      coordinator.update("workspace", "channel", { isReadLater: true, isActiveForRouting: false }),
    InvalidReadLaterChannelError,
  );
  assertEquals(calls.length, 0);
  assertEquals(
    (await coordinator.update("workspace", "channel", { isReadLater: true })).isReadLater,
    true,
  );
});
