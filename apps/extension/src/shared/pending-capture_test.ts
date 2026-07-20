import { assertEquals } from "@std/assert";
import { pendingCaptureKey } from "./pending-capture.ts";

Deno.test("pending capture storage keys are isolated by capture ID", () => {
  assertEquals(pendingCaptureKey("capture-a"), "pendingCapture:capture-a");
  assertEquals(pendingCaptureKey("capture-b"), "pendingCapture:capture-b");
});
