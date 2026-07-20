import { assertEquals } from "@std/assert";
import { CaptureSchema } from "../../../../packages/contracts/mod.ts";
import { createCapturePayload } from "./capture.ts";

Deno.test("extension capture payload satisfies the shared API contract", () => {
  const payload = createCapturePayload({
    captureId: "019432f0-7c00-7000-8000-000000000001",
    kind: "selection",
    metadata: {
      title: "Deno article",
      url: "https://example.com/post?utm_source=discord",
      canonicalUrl: "https://example.com/post",
      description: "A useful article",
      selectedText: "  Selected   context  ",
    },
  });
  const parsed = CaptureSchema.parse(payload);
  assertEquals(parsed.selectedQuote, "Selected context");
  assertEquals(parsed.metadata.canonicalUrl, "https://example.com/post");
});
