import type { PageMetadata } from "../metadata.ts";
import type { CaptureKind, CapturePayload } from "./types.ts";
import { cleanOptionalText } from "./types.ts";

type CapturePayloadInput = {
  captureId: string;
  kind: CaptureKind;
  metadata: PageMetadata;
  tabUrl?: string;
  tabTitle?: string;
  linkUrl?: string;
  selectionText?: string;
};

export function createCapturePayload(
  input: CapturePayloadInput,
): CapturePayload {
  const url = input.kind === "link"
    ? input.linkUrl
    : input.metadata.url || input.tabUrl;
  if (!url) throw new Error("The captured page has no URL");
  return {
    captureId: input.captureId,
    url,
    title: cleanOptionalText(input.metadata.title || input.tabTitle, 1_000) ??
      "Untitled",
    selectedQuote: cleanOptionalText(
      input.selectionText ?? input.metadata.selectedText,
      10_000,
    ),
    linkText: input.kind === "link"
      ? cleanOptionalText(input.selectionText, 500)
      : null,
    outputLanguage: "pt-BR",
    metadata: {
      canonicalUrl: input.kind === "link"
        ? null
        : input.metadata.canonicalUrl ?? null,
      description: cleanOptionalText(input.metadata.description, 5_000),
      siteName: cleanOptionalText(input.metadata.siteName, 500),
      author: cleanOptionalText(input.metadata.author, 500),
      publishedAt: input.metadata.publishedAt ?? null,
      imageUrl: input.metadata.imageUrl ?? null,
      sourceLanguage: null,
    },
  };
}
