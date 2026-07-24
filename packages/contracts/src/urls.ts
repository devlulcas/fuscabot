const TRACKING_PARAMETERS = new Set([
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
]);
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function isTrackingParameter(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_PARAMETERS.has(normalized);
}

function parseHttpUrl(value: string, base?: string): URL | null {
  try {
    const url = base === undefined ? new URL(value) : new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return url;
  } catch {
    return null;
  }
}

/** Converts a supported YouTube link to one stable link. */
export function canonicalYouTubeUrl(value: string): string | null {
  const videoId = youtubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

/** Derives a YouTube preview image URL without persisting video metadata. */
export function youtubeThumbnailUrl(value: string): string | null {
  const videoId = youtubeVideoId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

function youtubeVideoId(value: string): string | null {
  const url = parseHttpUrl(value);
  if (url === null) return null;

  const hostname = url.hostname.toLowerCase();
  let videoId: string | null = null;
  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (["shorts", "live", "embed"].includes(segments[0] ?? "")) {
      videoId = segments[1] ?? null;
    }
  }
  if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return null;
  return videoId;
}

/** Safely cleans a URL without discarding application-significant state. */
export function normalizeUrl(value: string): string {
  const url = parseHttpUrl(value);
  if (url === null) throw new TypeError("Expected an absolute HTTP(S) URL");

  url.hostname = url.hostname.toLowerCase();
  for (const name of [...url.searchParams.keys()]) {
    if (isTrackingParameter(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();

  // URL serialization already removes default ports and an empty trailing '#'.
  return url.href;
}

function isRelatedHost(original: string, candidate: string): boolean {
  if (original === candidate) return true;
  const withoutWww = (host: string): string =>
    host.startsWith("www.") ? host.slice(4) : host;
  if (withoutWww(original) === withoutWww(candidate)) return true;

  // Moving from a host to one of its children is safe. Moving to an arbitrary
  // parent is not: the parent could be a public suffix such as `com`/`co.uk`.
  return candidate.endsWith(`.${original}`);
}

/** Resolves a page canonical and rejects credentials, non-web URLs, and unrelated hosts. */
export function selectCanonicalUrl(
  originalUrl: string,
  pageCanonical: string | null | undefined,
): string | null {
  if (
    pageCanonical === null || pageCanonical === undefined ||
    pageCanonical.trim() === ""
  ) {
    return null;
  }

  const original = parseHttpUrl(originalUrl);
  const canonical = parseHttpUrl(pageCanonical, originalUrl);
  if (original === null) {
    throw new TypeError("Expected an absolute HTTP(S) original URL");
  }
  if (
    canonical === null || !isRelatedHost(original.hostname, canonical.hostname)
  ) return null;
  return normalizeUrl(canonical.href);
}

export type CanonicalUrlSet = {
  originalUrl: string;
  normalizedUrl: string;
  canonicalUrl: string | null;
  canonicalUrlKey: string;
  sourceDomain: string;
};

export function canonicalizeUrl(
  originalUrl: string,
  pageCanonical?: string | null,
): CanonicalUrlSet {
  const youtubeUrl = canonicalYouTubeUrl(originalUrl);
  if (youtubeUrl) {
    return {
      originalUrl: youtubeUrl,
      normalizedUrl: youtubeUrl,
      canonicalUrl: youtubeUrl,
      canonicalUrlKey: youtubeUrl,
      sourceDomain: "youtube.com",
    };
  }

  const normalizedUrl = normalizeUrl(originalUrl);
  const canonicalUrl = selectCanonicalUrl(originalUrl, pageCanonical);
  return {
    originalUrl,
    normalizedUrl,
    canonicalUrl,
    canonicalUrlKey: canonicalUrl ?? normalizedUrl,
    sourceDomain: new URL(normalizedUrl).hostname,
  };
}
