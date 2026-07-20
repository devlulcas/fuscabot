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
  linkText?: string;
};

export function createCapturePayload(
  input: CapturePayloadInput,
): CapturePayload {
  const url = input.kind === "link"
    ? input.linkUrl
    : input.metadata.url || input.tabUrl;
  if (!url) throw new Error("The captured page has no URL");
  const linkText = input.kind === "link"
    ? cleanOptionalText(input.linkText, 500)
    : null;
  const title = input.kind === "link"
    ? linkText ?? safeHostname(url) ?? "Untitled link"
    : cleanOptionalText(
      input.metadata.openGraphTitle ?? input.metadata.title ?? input.tabTitle,
      1_000,
    ) ?? "Untitled";
  return {
    captureId: input.captureId,
    url,
    title,
    selectedQuote: input.kind === "selection"
      ? cleanOptionalText(
        input.selectionText ?? input.metadata.selectedText,
        10_000,
      )
      : null,
    linkText,
    outputLanguage: "pt-BR",
    metadata: {
      canonicalUrl: input.kind === "link"
        ? null
        : safeHttpUrl(input.metadata.canonicalUrl, input.metadata.url),
      description: cleanOptionalText(
        input.metadata.openGraphDescription ?? input.metadata.description,
        5_000,
      ),
      siteName: cleanOptionalText(input.metadata.siteName, 500),
      author: cleanOptionalText(input.metadata.author, 500),
      publishedAt: safeDateTime(input.metadata.publishedAt),
      imageUrl: safeHttpUrl(input.metadata.imageUrl, input.metadata.url),
      sourceLanguage: cleanOptionalText(input.metadata.sourceLanguage, 32),
    },
  };
}

function safeHttpUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function safeHostname(value: string): string | null {
  return safeHttpUrl(value, value) ? new URL(value).hostname : null;
}

function safeDateTime(value: string | undefined): string | null {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
}
