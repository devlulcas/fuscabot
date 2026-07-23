import { describe, expect, it, vi } from "vitest";
import { installRuntimeBridge } from "./runtime-bridge.ts";

describe("capture runtime bridge", () => {
  it("invalidates only the matching capture keys", () => {
    let listener: ((message: Record<string, unknown>) => void) | undefined;
    const removeListener = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: (value: typeof listener) => listener = value,
          removeListener,
        },
      },
    });
    const invalidateQueries = vi.fn(() => Promise.resolve());
    const dispose = installRuntimeBridge({ invalidateQueries } as never);
    listener?.({
      type: "capture-updated",
      captureId: "capture-1",
      resourceId: "resource-1",
    });
    listener?.({ type: "unrelated", captureId: "capture-2" });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["pending-capture", "capture-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["resources", "detail", "resource-1"],
    });
    dispose();
    expect(removeListener).toHaveBeenCalledOnce();
  });
});
