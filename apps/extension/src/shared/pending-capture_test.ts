import { assertEquals } from "@std/assert";
import {
  getPendingCapture,
  PENDING_CAPTURE_RETENTION_MS,
  pendingCaptureKey,
} from "./pending-capture.ts";

Deno.test("pending capture storage keys are isolated by capture ID", () => {
  assertEquals(pendingCaptureKey("capture-a"), "pendingCapture:capture-a");
  assertEquals(pendingCaptureKey("capture-b"), "pendingCapture:capture-b");
});

Deno.test("corrupt pending capture records are ignored", async () => {
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
  assertEquals(
    await getPendingCapture("capture-a", Date.parse("2026-07-21T00:00:00Z")),
    {
      captureId: "capture-a",
      state: "ready",
      resourceId: "resource-a",
      savedAt: "2026-07-20T00:00:00.000Z",
    },
  );
  assertEquals(removed, []);
});

Deno.test("pending captures expire after 14 days", async () => {
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
  assertEquals(
    await getPendingCapture(
      "capture-a",
      Date.parse(savedAt) + PENDING_CAPTURE_RETENTION_MS,
    ),
    undefined,
  );
  assertEquals(removed, "pendingCapture:capture-a");
});
