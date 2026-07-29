import { expect, it } from "vitest";
import {
  getPendingCapture,
  PENDING_CAPTURE_RETENTION_MS,
  pendingCaptureKey,
} from "./pending-capture.ts";

it("pending capture storage keys are isolated by capture ID", () => {
  expect(pendingCaptureKey("capture-a")).toBe("pendingCapture:capture-a");
  expect(pendingCaptureKey("capture-b")).toBe("pendingCapture:capture-b");
});

it("corrupt pending capture records are ignored", async () => {
  const removed: Array<string | string[]> = [];
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: () =>
            Promise.resolve({
              "pendingCapture:capture-a": {
                captureId: "capture-a",
                state: "surprise",
              },
              pendingCapture: {
                captureId: "capture-a",
                state: "ready",
                resourceId: "resource-a",
                savedAt: "2026-07-20T00:00:00.000Z",
              },
            }),
          remove: (keys: string | string[]) => {
            removed.push(keys);
            return Promise.resolve();
          },
        },
      },
    },
  });
  expect(
    await getPendingCapture("capture-a", Date.parse("2026-07-21T00:00:00Z")),
  ).toEqual({
    captureId: "capture-a",
    state: "ready",
    resourceId: "resource-a",
    savedAt: "2026-07-20T00:00:00.000Z",
  });
  expect(removed).toEqual([]);
});

it("pending captures expire after 14 days", async () => {
  const savedAt = "2026-07-01T00:00:00.000Z";
  let removed: string | string[] | undefined;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: () =>
            Promise.resolve({
              "pendingCapture:capture-a": {
                captureId: "capture-a",
                state: "ready",
                resourceId: "resource-a",
                savedAt,
              },
            }),
          remove: (keys: string | string[]) => {
            removed = keys;
            return Promise.resolve();
          },
        },
      },
    },
  });
  expect(
    await getPendingCapture(
      "capture-a",
      Date.parse(savedAt) + PENDING_CAPTURE_RETENTION_MS,
    ),
  ).toBeUndefined();
  expect(removed).toBe("pendingCapture:capture-a");
});
