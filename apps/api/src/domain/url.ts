const TRACKING_KEYS = new Set(["gclid", "fbclid", "mc_cid", "mc_eid"]);

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  if (url.hash === "#") url.hash = "";
  return url.toString();
}

export function trustedCanonical(original: string, canonical?: string | null): string | null {
  if (!canonical) return null;
  const resolved = new URL(canonical, original);
  const source = new URL(original);
  const sameHost = resolved.hostname === source.hostname ||
    resolved.hostname.endsWith(`.${source.hostname}`) ||
    source.hostname.endsWith(`.${resolved.hostname}`);
  return sameHost ? resolved.toString() : null;
}
