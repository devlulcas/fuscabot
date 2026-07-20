export type PageMetadata = {
  title: string;
  openGraphTitle?: string;
  url: string;
  canonicalUrl?: string;
  description?: string;
  openGraphDescription?: string;
  imageUrl?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  selectedText?: string;
  sourceLanguage?: string;
  excerpt?: string;
};

/** This self-contained function is serialized by chrome.scripting.executeScript. */
export function extractPageMetadata(): PageMetadata {
  const content = (selector: string): string | undefined =>
    document.querySelector(selector)?.getAttribute("content")?.trim() ||
    undefined;
  const canonicalHref = document.querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  const resolveUrl = (value: string | null | undefined): string | undefined => {
    if (!value) return undefined;
    try {
      const url = new URL(value, location.href);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.href
        : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    title: document.title,
    openGraphTitle: content('meta[property="og:title"]'),
    url: location.href,
    canonicalUrl: resolveUrl(canonicalHref),
    description: content('meta[name="description"]'),
    openGraphDescription: content('meta[property="og:description"]'),
    imageUrl: resolveUrl(content('meta[property="og:image"]')),
    siteName: content('meta[property="og:site_name"]'),
    author: content('meta[property="article:author"]') ??
      content('meta[name="author"]'),
    publishedAt: content('meta[property="article:published_time"]'),
    selectedText: getSelection()?.toString().trim() || undefined,
    sourceLanguage: document.documentElement.lang.trim() || undefined,
    excerpt: (document.querySelector("article, main")?.textContent ??
      document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(
        0,
        2_000,
      ) ||
      undefined,
  };
}
