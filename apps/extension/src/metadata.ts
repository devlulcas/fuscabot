export type PageMetadata = {
  title: string;
  url: string;
  canonicalUrl?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  selectedText?: string;
};

/** This self-contained function is serialized by chrome.scripting.executeScript. */
export function extractPageMetadata(): PageMetadata {
  const content = (selector: string): string | undefined =>
    document.querySelector(selector)?.getAttribute("content")?.trim() ||
    undefined;
  const canonicalUrl = document.querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  return {
    title: document.title,
    url: location.href,
    canonicalUrl: canonicalUrl
      ? new URL(canonicalUrl, location.href).href
      : undefined,
    description: content('meta[name="description"]'),
    imageUrl: content('meta[property="og:image"]'),
    siteName: content('meta[property="og:site_name"]'),
    author: content('meta[property="article:author"]') ??
      content('meta[name="author"]'),
    publishedAt: content('meta[property="article:published_time"]'),
    selectedText: getSelection()?.toString().trim() || undefined,
  };
}
