import { describe, expect, it } from "vitest";
import {
  canPublish,
  resolveDestination,
  saveBeforeDelivery,
} from "./capture-policy.ts";

describe("capture publishing policy", () => {
  it("waits for the manual AI action to leave preparing state", () => {
    expect(canPublish("preparing")).toBe(false);
    expect(canPublish("ready")).toBe(true);
    expect(canPublish("failed")).toBe(true);
  });

  it("uses only available destinations and respects a manual clear", () => {
    const availableChannelIds = new Set(["available"]);
    expect(resolveDestination({
      enrichmentStatus: "ready",
      selectionStatus: "",
      selectedChannelId: "",
      suggestedChannelId: "available",
      availableChannelIds,
    })).toBe("available");
    expect(resolveDestination({
      enrichmentStatus: "ready",
      selectionStatus: "",
      selectedChannelId: "",
      suggestedChannelId: "stale",
      availableChannelIds,
    })).toBe("");
    expect(resolveDestination({
      enrichmentStatus: "ready",
      selectionStatus: "ready",
      selectedChannelId: "",
      suggestedChannelId: "available",
      availableChannelIds,
    })).toBe("");
  });

  it("saves visible edits before delivery and stops when saving fails", async () => {
    const calls: string[] = [];
    await expect(saveBeforeDelivery(
      { title: "Visible title" },
      (patch) => {
        calls.push(`save:${patch.title}`);
        return Promise.resolve();
      },
      () => {
        calls.push("deliver");
        return Promise.resolve("sent");
      },
    )).resolves.toBe("sent");
    expect(calls).toEqual(["save:Visible title", "deliver"]);

    await expect(saveBeforeDelivery(
      {},
      () => Promise.reject(new Error("save failed")),
      () => {
        calls.push("must-not-deliver");
        return Promise.resolve();
      },
    )).rejects.toThrow("save failed");
    expect(calls).not.toContain("must-not-deliver");
  });
});
