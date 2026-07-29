import { expect, it } from "vitest";
import { CaptureSchema } from "../../../../packages/contracts/mod.ts";
import { createCapturePayload } from "./capture.ts";

it("extension capture payload satisfies the shared API contract", () => {
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
  expect(parsed.selectedQuote).toBe("Selected context");
  expect(parsed.metadata.canonicalUrl).toBe("https://example.com/post");
});

it("page capture prefers Open Graph copy and sanitizes optional metadata", () => {
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
  expect(payload.title).toBe("Open Graph title");
  expect(payload.selectedQuote).toBeNull();
  expect(payload.metadata.canonicalUrl).toBe("https://example.com/post");
  expect(payload.metadata.description).toBe("Open Graph description");
  expect(payload.metadata.imageUrl).toBe("https://example.com/images/card.png");
  expect(payload.metadata.publishedAt).toBeNull();
  expect(payload.metadata.sourceLanguage).toBe("pt-BR");
  CaptureSchema.parse(payload);
});

it("link capture uses target semantics and not containing-page metadata", () => {
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
  expect(payload.url).toBe("https://target.example/tool");
  expect(payload.title).toBe("Useful tool");
  expect(payload.linkText).toBe("Useful tool");
  expect(payload.selectedQuote).toBeNull();
  expect(payload.metadata.canonicalUrl).toBeNull();
});
