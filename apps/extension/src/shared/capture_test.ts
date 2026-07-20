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

Deno.test("page capture prefers Open Graph copy and sanitizes optional metadata", () => {
  const payload = createCapturePayload({
    captureId: "019432f0-7c00-7000-8000-000000000002",
    kind: "page",
    metadata: {
      title: "Document title",
      openGraphTitle: "Open Graph title",
      url: "https://example.com/articles/post",
      canonicalUrl: "../post",
      description: "Meta description",
      openGraphDescription: "Open Graph description",
      imageUrl: "/images/card.png",
      publishedAt: "not a date",
      sourceLanguage: "pt-BR",
      selectedText: "Unrelated selection",
    },
  });
  assertEquals(payload.title, "Open Graph title");
  assertEquals(payload.selectedQuote, null);
  assertEquals(payload.metadata.canonicalUrl, "https://example.com/post");
  assertEquals(payload.metadata.description, "Open Graph description");
  assertEquals(
    payload.metadata.imageUrl,
    "https://example.com/images/card.png",
  );
  assertEquals(payload.metadata.publishedAt, null);
  assertEquals(payload.metadata.sourceLanguage, "pt-BR");
  CaptureSchema.parse(payload);
});

Deno.test("link capture uses target semantics and not containing-page metadata", () => {
  const payload = createCapturePayload({
    captureId: "019432f0-7c00-7000-8000-000000000003",
    kind: "link",
    linkUrl: "https://target.example/tool",
    linkText: "Useful tool",
    selectionText: "Containing-page selection",
    metadata: {
      title: "Containing page",
      url: "https://source.example/article",
      canonicalUrl: "https://source.example/canonical",
    },
  });
  assertEquals(payload.url, "https://target.example/tool");
  assertEquals(payload.title, "Useful tool");
  assertEquals(payload.linkText, "Useful tool");
  assertEquals(payload.selectedQuote, null);
  assertEquals(payload.metadata.canonicalUrl, null);
});
