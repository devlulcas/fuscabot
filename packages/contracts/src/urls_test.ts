import { assertEquals, assertThrows } from "@std/assert";
import {
  canonicalizeUrl,
  canonicalYouTubeUrl,
  normalizeUrl,
  selectCanonicalUrl,
  youtubeThumbnailUrl,
} from "./urls.ts";

Deno.test("normalizeUrl removes only known tracking parameters", () => {
  assertEquals(
    normalizeUrl(
      "HTTPS://Example.COM:443/path?utm_source=x&tab=code&FBCLID=y#install",
    ),
    "https://example.com/path?tab=code#install",
  );
});

Deno.test("normalizeUrl preserves unknown parameters and meaningful fragments", () => {
  assertEquals(
    normalizeUrl("https://example.com/doc?version=2&q=deno#api"),
    "https://example.com/doc?q=deno&version=2#api",
  );
});

Deno.test("normalizeUrl rejects non-web and credential-bearing URLs", () => {
  assertThrows(() => normalizeUrl("javascript:alert(1)"), TypeError);
  assertThrows(
    () => normalizeUrl("https://user:secret@example.com"),
    TypeError,
  );
});

Deno.test("selectCanonicalUrl resolves related relative and subdomain canonicals", () => {
  assertEquals(
    selectCanonicalUrl(
      "https://www.example.com/a/page",
      "/articles/page?utm_medium=social",
    ),
    "https://www.example.com/articles/page",
  );
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "https://docs.example.com/a"),
    "https://docs.example.com/a",
  );
});

Deno.test("selectCanonicalUrl rejects unrelated and unsafe canonicals", () => {
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "https://attacker.test/a"),
    null,
  );
  assertEquals(
    selectCanonicalUrl("https://example.com/a", "mailto:a@example.com"),
    null,
  );
  assertEquals(
    selectCanonicalUrl("https://docs.example.co.uk/a", "https://co.uk/a"),
    null,
  );
});

Deno.test("canonicalizeUrl chooses the accepted canonical as duplicate key", () => {
  assertEquals(
    canonicalizeUrl("https://example.com/a?utm_source=x", "/article"),
    {
      originalUrl: "https://example.com/a?utm_source=x",
      normalizedUrl: "https://example.com/a",
      canonicalUrl: "https://example.com/article",
      canonicalUrlKey: "https://example.com/article",
      sourceDomain: "example.com",
    },
  );
});

Deno.test("YouTube variants share one canonical identity", () => {
  const expectedKey = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  for (
    const url of [
      "https://youtu.be/dQw4w9WgXcQ?si=share-token",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=chat",
      "https://m.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
    ]
  ) {
    const result = canonicalizeUrl(url);
    assertEquals(result.canonicalUrlKey, expectedKey);
    assertEquals(result.canonicalUrl, expectedKey);
    assertEquals(result.originalUrl, expectedKey);
    assertEquals(result.normalizedUrl, expectedKey);
    assertEquals(result.sourceDomain, "youtube.com");
  }
});

Deno.test("YouTube identity drops timestamps and share parameters", () => {
  assertEquals(
    canonicalYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?si=token&t=1h2m3s"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assertEquals(
    canonicalizeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=90")
      .normalizedUrl,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assertEquals(
    youtubeThumbnailUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
});

Deno.test("YouTube parser rejects channels, playlists, and malformed video IDs", () => {
  for (
    const url of [
      "https://www.youtube.com/@deno_land",
      "https://www.youtube.com/playlist?list=PL123",
      "https://youtu.be/too-short",
      "https://notyoutube.example/watch?v=dQw4w9WgXcQ",
    ]
  ) {
    assertEquals(canonicalYouTubeUrl(url), null);
  }
});
