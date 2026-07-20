// @ts-nocheck Browser-injected function is checked against Chrome at runtime.
export function extractPageMetadata() {
  const content = (selector) =>
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
    openGraph: {
      title: content('meta[property="og:title"]'),
      description: content('meta[property="og:description"]'),
      imageUrl: content('meta[property="og:image"]'),
      siteName: content('meta[property="og:site_name"]'),
    },
    article: {
      author: content('meta[property="article:author"]') ??
        content('meta[name="author"]'),
      publishedAt: content('meta[property="article:published_time"]'),
    },
    selectedText: getSelection()?.toString().trim() || undefined,
  };
}
