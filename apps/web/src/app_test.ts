import { assert, assertEquals, assertMatch, assertNotMatch } from "@std/assert";
import { createPublicWebApp } from "./app.tsx";
import type {
  ArchiveLocale,
  PublicArchiveItem,
  PublicArchiveListQuery,
  PublicArchiveReader,
} from "./archive.ts";
import { CLIENT_JS, CLIENT_PATH, THEME_BOOT_JS, THEME_BOOT_PATH } from "./client_assets.ts";
import { ARCHIVE_CSS, STYLE_PATH } from "./styles.ts";

const item: PublicArchiveItem = {
  slug: "useful-link-a1b2c3d4",
  title: "A useful <link>",
  summary: "A concise & useful summary.",
  selectedText: `A selected "passage"`,
  sourceDomain: "example.com",
  outboundUrl: "https://example.com/path",
  publishedAt: new Date("2026-06-01T12:00:00Z"),
  updatedAt: new Date("2026-06-02T12:00:00Z"),
  tags: [{ slug: "design", label: "Design" }],
};

class FakeReader implements PublicArchiveReader {
  lastQuery?: PublicArchiveListQuery;
  currentItem: PublicArchiveItem | null = item;
  total = 1;

  list(query: PublicArchiveListQuery) {
    this.lastQuery = query;
    return Promise.resolve({
      items: this.total ? [item] : [],
      total: this.total,
      tags: [{ slug: "design", label: query.locale === "en" ? "Design" : "Projeto" }],
    });
  }

  getBySlug(_slug: string, _locale: ArchiveLocale) {
    return Promise.resolve(this.currentItem);
  }

  listForSitemap() {
    return Promise.resolve([{ slug: item.slug, updatedAt: item.updatedAt }]);
  }
}

function app(reader = new FakeReader(), analytics = false) {
  return {
    reader,
    app: createPublicWebApp({
      reader,
      origin: "https://fuscabot.example",
      umami: analytics
        ? {
          scriptUrl: "https://cloud.umami.is/script.js",
          websiteId: "b7f428a4-b9d3-402d-a8ec-f5ba944f728f",
          domain: "fuscabot.example",
        }
        : undefined,
    }),
  };
}

Deno.test("root negotiates Brazilian Portuguese without touching the reader", async () => {
  const { app: web, reader } = app();
  const response = await web.request("/", {
    headers: { "Accept-Language": "en;q=.5, pt-BR;q=.9" },
  });

  assertEquals(response.status, 302);
  assertEquals(response.headers.get("location"), "/pt-br/");
  assertEquals(response.headers.get("vary"), "Accept-Language");
  assertEquals(reader.lastQuery, undefined);
});

Deno.test("root defaults to English for generic Portuguese and absent preferences", async () => {
  const { app: web } = app();
  assertEquals(
    (await web.request("/", { headers: { "Accept-Language": "pt-PT" } })).headers.get("location"),
    "/en/",
  );
  assertEquals((await web.request("/")).headers.get("location"), "/en/");
});

Deno.test("archive renders semantic escaped content and passes normalized query", async () => {
  const { app: web, reader } = app();
  const response = await web.request("/en/?q=%20useful%20&tag=design&page=1");
  const body = await response.text();

  assertEquals(response.status, 200);
  assertMatch(body.toLowerCase(), /^<!doctype html>/);
  assertEquals(reader.lastQuery, {
    locale: "en",
    query: "useful",
    tag: "design",
    page: 1,
    pageSize: 20,
  });
  assertMatch(body, /<main id="main"/);
  assertMatch(body, /data-theme-control="true"/);
  assertMatch(body, new RegExp(`src="${THEME_BOOT_PATH.replaceAll("/", "\\/")}"`));
  assertMatch(body, new RegExp(`src="${CLIENT_PATH.replaceAll("/", "\\/")}"`));
  assertMatch(body, /href="https:\/\/github\.com\/devlulcas"/);
  assertMatch(body, /href="https:\/\/www\.lucasalvesrego\.com\/"/);
  assertMatch(body, /aria-label="Creator links"/);
  assertMatch(body, /A useful &lt;link&gt;/);
  assertNotMatch(body, /A useful <link>/);
  assertMatch(
    body,
    /rel="canonical" href="https:\/\/fuscabot\.example\/en\/\?q=useful&amp;tag=design"/,
  );
  assertMatch(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assertEquals(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert(response.headers.get("etag"));
});

Deno.test("archive localizes interface and empty results", async () => {
  const { app: web, reader } = app();
  reader.total = 0;
  const body = await (await web.request("/pt-br/?tag=unknown")).text();

  assertMatch(body, /lang="pt-br"/);
  assertMatch(body, /Nenhum recurso público/);
  assertEquals(reader.lastQuery?.tag, "unknown");
});

Deno.test("archive rejects unknown, repeated, excessive, and invalid query values", async () => {
  const { app: web } = app();
  for (
    const path of [
      "/en/?private=true",
      "/en/?q=one&q=two",
      `/en/?q=${"a".repeat(101)}`,
      "/en/?tag=../private",
      "/en/?page=0",
      "/en/?page=1.5",
    ]
  ) {
    const response = await web.request(path);
    assertEquals(response.status, 400, path);
    assertEquals(response.headers.get("cache-control"), "no-store");
  }
});

Deno.test("archive rejects pages beyond a non-empty result set", async () => {
  const { app: web } = app();
  assertEquals((await web.request("/en/?page=2")).status, 400);
});

Deno.test("detail renders public projection and safe outbound analytics attributes", async () => {
  const { app: web } = app();
  const response = await web.request(`/en/links/${item.slug}`);
  const body = await response.text();

  assertEquals(response.status, 200);
  assertMatch(body, /A selected &quot;passage&quot;/);
  assertMatch(body, /href="https:\/\/example\.com\/path"/);
  assertMatch(body, /rel="noopener noreferrer external"/);
  assertMatch(body, /data-umami-event="outbound-link"/);
  assertMatch(body, /data-umami-event-source-domain="example\.com"/);
  assertNotMatch(body, /personalNote|originalUrl|workspaceId/);
});

Deno.test("detail treats missing, malformed, and unsafe records as the same generic 404", async () => {
  const { app: web, reader } = app();
  reader.currentItem = null;
  const missing = await web.request(`/en/links/${item.slug}`);
  const malformed = await web.request("/en/links/NOT_VALID");
  reader.currentItem = { ...item, outboundUrl: "https://user:secret@example.com" };
  const unsafe = await web.request(`/en/links/${item.slug}`);

  assertEquals(missing.status, 404);
  assertEquals(malformed.status, 404);
  assertEquals(unsafe.status, 404);
  assertMatch(await missing.text(), /This page is unavailable or is no longer public/);
  assertMatch(await unsafe.text(), /This page is unavailable or is no longer public/);
});

Deno.test("unknown routes use localized generic 404 pages", async () => {
  const { app: web } = app();
  const response = await web.request("/pt-br/nao-existe");
  assertEquals(response.status, 404);
  assertMatch(await response.text(), /Página não encontrada/);
});

Deno.test("analytics is absent by default and constrained when configured", async () => {
  const plain = await (await app().app.request("/en/")).text();
  assertNotMatch(plain, /cloud\.umami\.is/);

  const response = await app(new FakeReader(), true).app.request("/en/");
  const tracked = await response.text();
  assertMatch(tracked, /src="https:\/\/cloud\.umami\.is\/script\.js"/);
  assertMatch(tracked, /data-website-id="b7f428a4-b9d3-402d-a8ec-f5ba944f728f"/);
  assertMatch(tracked, /data-do-not-track="true"/);
  assertMatch(tracked, /data-exclude-search="true"/);
  assertMatch(tracked, /data-domains="fuscabot\.example"/);
  assertMatch(response.headers.get("content-security-policy") ?? "", /https:\/\/cloud\.umami\.is/);
});

Deno.test("robots, sitemap, and fingerprinted assets have appropriate policies", async () => {
  const { app: web } = app();
  assertEquals(STYLE_PATH, `/assets/archive-${await shortHash(ARCHIVE_CSS)}.css`);
  assertEquals(CLIENT_PATH, `/assets/archive-client-${await shortHash(CLIENT_JS)}.js`);
  assertEquals(THEME_BOOT_PATH, `/assets/archive-theme-${await shortHash(THEME_BOOT_JS)}.js`);
  const robots = await web.request("/robots.txt");
  assertMatch(await robots.text(), /Sitemap: https:\/\/fuscabot\.example\/sitemap\.xml/);
  assert(robots.headers.get("etag"));

  const sitemap = await web.request("/sitemap.xml");
  const xml = await sitemap.text();
  assertMatch(xml, /https:\/\/fuscabot\.example\/en\/links\/useful-link-a1b2c3d4/);
  assertMatch(xml, /https:\/\/fuscabot\.example\/pt-br\/links\/useful-link-a1b2c3d4/);
  assertMatch(xml, /2026-06-02T12:00:00\.000Z/);

  const css = await web.request(STYLE_PATH);
  assertEquals(css.headers.get("cache-control"), "public, max-age=31536000, immutable");
  const stylesheet = await css.text();
  assertMatch(stylesheet, /prefers-reduced-motion/);
  assertMatch(stylesheet, /@view-transition/);
  assertMatch(stylesheet, /:root\[data-theme="dark"\]/);
  assertMatch(stylesheet, /min-height: 100dvh/);
  assertMatch(stylesheet, /margin-top: auto/);
  assertMatch(stylesheet, /padding-block: clamp\(1\.8rem, 4vw, 2\.8rem\)/);

  for (const path of [THEME_BOOT_PATH, CLIENT_PATH]) {
    const asset = await web.request(path);
    assertEquals(asset.status, 200);
    assertEquals(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assertMatch(asset.headers.get("content-type") ?? "", /text\/javascript/);
    assertMatch(await asset.text(), /fuscabot-theme/);
  }
});

Deno.test("matching ETag receives a bodyless 304 response", async () => {
  const { app: web } = app();
  const first = await web.request("/en/");
  const etag = first.headers.get("etag");
  assert(etag);
  const second = await web.request("/en/", { headers: { "If-None-Match": etag } });
  assertEquals(second.status, 304);
  assertEquals(await second.text(), "");
});

Deno.test("reader failures become private generic error pages", async () => {
  const reader = new FakeReader();
  reader.list = () => {
    throw new Error("secret database detail");
  };
  const response = await app(reader).app.request("/en/");
  const body = await response.text();
  assertEquals(response.status, 500);
  assertNotMatch(body, /secret database detail/);
});

Deno.test("configuration rejects unsafe origins and analytics", () => {
  const reader = new FakeReader();
  for (const origin of ["javascript:alert(1)", "https://user:password@example.com/path"]) {
    let thrown = false;
    try {
      createPublicWebApp({ reader, origin });
    } catch {
      thrown = true;
    }
    assert(thrown);
  }

  let thrown = false;
  try {
    createPublicWebApp({
      reader,
      origin: "https://fuscabot.example",
      umami: {
        scriptUrl: "http://analytics.example/script.js",
        websiteId: "id",
        domain: "example.com",
      },
    });
  } catch {
    thrown = true;
  }
  assert(thrown);
});

async function shortHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes).slice(0, 4))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
