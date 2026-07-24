import { Hono } from "@hono/hono";
import type { Context, MiddlewareHandler } from "@hono/hono";
import { serveStatic } from "@hono/hono/deno";
import { raw } from "@hono/hono/html";
import type { Child } from "@hono/hono/jsx";
import { fromFileUrl } from "@std/path";
import type { ArchiveLocale, PublicArchiveItem, PublicArchiveReader } from "./archive.ts";
import { CLIENT_JS, CLIENT_PATH, THEME_BOOT_JS, THEME_BOOT_PATH } from "./client_assets.ts";
import { ARCHIVE_CSS, DARK_ARTWORK_PATH, STYLE_PATH } from "./styles.ts";

const PAGE_SIZE = 20 as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ARTWORK_PATH =
  "/assets/artwork/landscape-with-windmill-anthonie-erkelens-0dfeab43.webp";
const ARTWORK_FILE = fromFileUrl(
  new URL(
    "../public/artwork/landscape-with-windmill-anthonie-erkelens-0dfeab43.webp",
    import.meta.url,
  ),
);
const DARK_ARTWORK_FILE = fromFileUrl(
  new URL(
    "../public/artwork/landscape-with-windmill-monochrome-fd649d8d.webp",
    import.meta.url,
  ),
);
export const SOCIAL_IMAGE_PATH = "/assets/social/fuscabot-og-e923a46a.jpg";
const SOCIAL_IMAGE_FILE = fromFileUrl(
  new URL("../public/social/fuscabot-og-e923a46a.jpg", import.meta.url),
);
export const FAVICON_PATHS = {
  svg: "/favicon.svg",
  png: "/favicon-96x96.png",
  ico: "/favicon.ico",
  appleTouchIcon: "/apple-touch-icon.png",
  manifest: "/site.webmanifest",
  manifest192: "/web-app-manifest-192x192.png",
  manifest512: "/web-app-manifest-512x512.png",
} as const;
const FAVICON_DIRECTORY = new URL("../public/favicon/", import.meta.url);
const FAVICON_ASSETS = [
  [FAVICON_PATHS.svg, fromFileUrl(new URL("favicon.svg", FAVICON_DIRECTORY))],
  [FAVICON_PATHS.png, fromFileUrl(new URL("favicon-96x96.png", FAVICON_DIRECTORY))],
  [FAVICON_PATHS.ico, fromFileUrl(new URL("favicon.ico", FAVICON_DIRECTORY))],
  [
    FAVICON_PATHS.appleTouchIcon,
    fromFileUrl(new URL("apple-touch-icon.png", FAVICON_DIRECTORY)),
  ],
  [FAVICON_PATHS.manifest, fromFileUrl(new URL("site.webmanifest", FAVICON_DIRECTORY))],
  [
    FAVICON_PATHS.manifest192,
    fromFileUrl(new URL("web-app-manifest-192x192.png", FAVICON_DIRECTORY)),
  ],
  [
    FAVICON_PATHS.manifest512,
    fromFileUrl(new URL("web-app-manifest-512x512.png", FAVICON_DIRECTORY)),
  ],
] as const;

export interface UmamiOptions {
  scriptUrl: string;
  websiteId: string;
  domain: string;
  hostUrl?: string;
}

export interface PublicWebAppOptions {
  reader: PublicArchiveReader;
  origin: string;
  umami?: UmamiOptions;
}

const copy = {
  en: {
    language: "English",
    alternateLanguage: "Português",
    subtitle: "A public collection of useful links, field notes, and discoveries.",
    skip: "Skip to content",
    search: "Search the archive",
    searchPlaceholder: "Title, tag, summary, or source",
    tag: "Filter by tag",
    allTags: "All tags",
    apply: "Apply",
    result: "resource",
    results: "resources",
    empty: "No public resources match these filters.",
    newer: "Newer",
    older: "Older",
    page: "Page",
    open: "Visit original source",
    published: "Published",
    updated: "Updated",
    back: "Return to the archive",
    notFoundTitle: "Page not found",
    notFoundBody: "This page is unavailable or is no longer public.",
    invalidTitle: "Invalid request",
    invalidBody: "Check the search and page values, then try again.",
    theme: "Theme",
    lightTheme: "Use light theme",
    darkTheme: "Use dark theme",
    footerLinks: "Creator links",
    website: "Website",
    artworkAlt: "A windmill beside a canal and wooden bridge",
    socialImageAlt: "Fuscabot Archive — A public collection of useful links",
  },
  "pt-br": {
    language: "Português",
    alternateLanguage: "English",
    subtitle: "Uma coleção pública de links úteis, notas de campo e descobertas.",
    skip: "Ir para o conteúdo",
    search: "Pesquisar no arquivo",
    searchPlaceholder: "Título, tag, resumo ou fonte",
    tag: "Filtrar por tag",
    allTags: "Todas as tags",
    apply: "Aplicar",
    result: "recurso",
    results: "recursos",
    empty: "Nenhum recurso público corresponde a estes filtros.",
    newer: "Mais recentes",
    older: "Mais antigos",
    page: "Página",
    open: "Visitar fonte original",
    published: "Publicado",
    updated: "Atualizado",
    back: "Voltar ao arquivo",
    notFoundTitle: "Página não encontrada",
    notFoundBody: "Esta página não está disponível ou deixou de ser pública.",
    invalidTitle: "Solicitação inválida",
    invalidBody: "Confira a pesquisa e a página e tente novamente.",
    theme: "Tema",
    lightTheme: "Usar tema claro",
    darkTheme: "Usar tema escuro",
    footerLinks: "Links do criador",
    website: "Site",
    artworkAlt: "Um moinho ao lado de um canal e uma ponte de madeira",
    socialImageAlt: "Fuscabot Archive — A public collection of useful links",
  },
} as const;

export function createPublicWebApp(options: PublicWebAppOptions): Hono {
  const origin = validateOrigin(options.origin);
  const analytics = validateUmami(options.umami);
  const app = new Hono();

  app.use("*", responsePolicy(analytics));

  app.get(STYLE_PATH, (c) =>
    c.body(ARCHIVE_CSS, 200, {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    }));
  app.get(CLIENT_PATH, (c) =>
    c.body(CLIENT_JS, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    }));
  app.get(THEME_BOOT_PATH, (c) =>
    c.body(THEME_BOOT_JS, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    }));
  app.get(ARTWORK_PATH, immutableStaticAsset(ARTWORK_FILE));
  app.get(DARK_ARTWORK_PATH, immutableStaticAsset(DARK_ARTWORK_FILE));
  app.get(SOCIAL_IMAGE_PATH, immutableStaticAsset(SOCIAL_IMAGE_FILE));
  for (const [path, file] of FAVICON_ASSETS) {
    app.get(path, staticAsset(file, "public, max-age=86400"));
  }

  app.get("/", (c) => {
    const locale = preferredLocale(c.req.header("Accept-Language"));
    c.header("Vary", "Accept-Language");
    c.header("Cache-Control", "no-store");
    return c.redirect(`/${locale}/`, 302);
  });

  for (const locale of ["en", "pt-br"] as const) {
    app.get(`/${locale}/`, async (c) => {
      const parsed = parseListQuery(c.req.url);
      if (!parsed.ok) return renderError(c, locale, origin, analytics, 400);

      const result = await options.reader.list({ locale, ...parsed.value, pageSize: PAGE_SIZE });
      const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (parsed.value.page > totalPages && result.total > 0) {
        return renderError(c, locale, origin, analytics, 400);
      }

      const canonical = archiveUrl(origin, locale, parsed.value);
      return c.html(
        <Document
          locale={locale}
          origin={origin}
          analytics={analytics}
          title="Fuscabot Archive"
          description={copy[locale].subtitle}
          canonical={canonical}
          alternatePath={pageUrl(
            otherLocale(locale),
            parsed.value.page,
            parsed.value.query,
            parsed.value.tag,
          )}
        >
          <ArchivePage
            locale={locale}
            items={result.items}
            tags={result.tags}
            total={result.total}
            page={parsed.value.page}
            totalPages={totalPages}
            query={parsed.value.query}
            tag={parsed.value.tag}
          />
        </Document>,
      );
    });

    app.get(`/${locale}/links/:slug`, async (c) => {
      const slug = c.req.param("slug");
      if (!SLUG_PATTERN.test(slug)) return renderError(c, locale, origin, analytics, 404);
      const item = await options.reader.getBySlug(slug, locale);
      if (!item || !safeOutboundUrl(item.outboundUrl)) {
        return renderError(c, locale, origin, analytics, 404);
      }

      const path = `/${locale}/links/${encodeURIComponent(item.slug)}`;
      return c.html(
        <Document
          locale={locale}
          origin={origin}
          analytics={analytics}
          title={`${item.title} — Fuscabot Archive`}
          description={metaDescription(item.summary ?? copy[locale].subtitle)}
          canonical={`${origin}${path}`}
          alternatePath={`/${otherLocale(locale)}/links/${encodeURIComponent(item.slug)}`}
        >
          <DetailPage locale={locale} item={item} />
        </Document>,
      );
    });
  }

  app.get(
    "/robots.txt",
    (c) =>
      c.text(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, 200, {
        "Content-Type": "text/plain; charset=utf-8",
      }),
  );

  app.get("/sitemap.xml", async (c) => {
    const items = await options.reader.listForSitemap();
    const urls = items.flatMap((item) =>
      (["en", "pt-br"] as const).map((locale) => {
        const location = `${origin}/${locale}/links/${encodeURIComponent(item.slug)}`;
        return `<url><loc>${
          escapeXml(location)
        }</loc><lastmod>${item.updatedAt.toISOString()}</lastmod></url>`;
      })
    ).join("");
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
      200,
      { "Content-Type": "application/xml; charset=utf-8" },
    );
  });

  app.notFound((c) => {
    const locale = localeFromPath(new URL(c.req.url).pathname);
    return renderError(c, locale, origin, analytics, 404);
  });

  app.onError((_error, c) => {
    const locale = localeFromPath(new URL(c.req.url).pathname);
    return renderError(c, locale, origin, analytics, 500);
  });

  return app;
}

function Document(props: {
  locale: ArchiveLocale;
  origin: string;
  analytics?: UmamiOptions;
  title: string;
  description: string;
  canonical: string;
  alternatePath: string;
  children: Child;
}) {
  const alternate = otherLocale(props.locale);
  const socialImage = `${props.origin}${SOCIAL_IMAGE_PATH}`;
  return (
    <>
      {raw("<!doctype html>")}
      <html lang={props.locale} data-theme="light">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#f4f0e5" />
          <meta name="description" content={props.description} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Fuscabot Archive" />
          <meta property="og:title" content={props.title} />
          <meta property="og:description" content={props.description} />
          <meta property="og:url" content={props.canonical} />
          <meta property="og:image" content={socialImage} />
          <meta property="og:image:secure_url" content={socialImage} />
          <meta property="og:image:type" content="image/jpeg" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content={copy[props.locale].socialImageAlt} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={props.title} />
          <meta name="twitter:description" content={props.description} />
          <meta name="twitter:image" content={socialImage} />
          <meta name="twitter:image:alt" content={copy[props.locale].socialImageAlt} />
          <link rel="icon" type="image/svg+xml" href={FAVICON_PATHS.svg} />
          <link rel="icon" type="image/png" sizes="96x96" href={FAVICON_PATHS.png} />
          <link rel="shortcut icon" href={FAVICON_PATHS.ico} />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href={FAVICON_PATHS.appleTouchIcon}
          />
          <meta name="apple-mobile-web-app-title" content="Fuscabot Archive" />
          <link rel="manifest" href={FAVICON_PATHS.manifest} />
          <title>{props.title}</title>
          <link rel="canonical" href={props.canonical} />
          <link rel="alternate" hreflang={props.locale} href={props.canonical} />
          <link
            rel="alternate"
            hreflang={alternate}
            href={`${props.origin}${props.alternatePath}`}
          />
          <script src={THEME_BOOT_PATH} />
          <link rel="stylesheet" href={STYLE_PATH} />
          {props.analytics
            ? (
              <script
                defer
                src={props.analytics.scriptUrl}
                data-website-id={props.analytics.websiteId}
                data-do-not-track="true"
                data-exclude-search="true"
                data-exclude-hash="true"
                data-domains={props.analytics.domain}
                data-host-url={props.analytics.hostUrl}
              />
            )
            : null}
        </head>
        <body>
          <a class="skip-link" href="#main">{copy[props.locale].skip}</a>
          <Header locale={props.locale} />
          {props.children}
          <footer>
            <figure class="artwork">
              <div class="artwork__visual">
                <img
                  class="artwork__image"
                  src={ARTWORK_PATH}
                  width="3891"
                  height="2719"
                  loading="lazy"
                  decoding="async"
                  alt={copy[props.locale].artworkAlt}
                />
              </div>
              <figcaption class="shell artwork__credit">
                The Elisha Whittelsey Collection, The Elisha Whittelsey Fund, 2003
              </figcaption>
            </figure>
            <div class="footer__bar">
              <div class="shell footer__inner">
                <span translate="no">Fuscabot Archive</span>
                <nav class="footer__links" aria-label={copy[props.locale].footerLinks}>
                  <a
                    href="https://github.com/devlulcas"
                    rel="noopener noreferrer external"
                  >
                    GitHub ↗
                  </a>
                  <a
                    href="https://www.lucasalvesrego.com/"
                    rel="noopener noreferrer external"
                  >
                    {copy[props.locale].website} ↗
                  </a>
                </nav>
              </div>
            </div>
          </footer>
          <script type="module" src={CLIENT_PATH} />
        </body>
      </html>
    </>
  );
}

function immutableStaticAsset(file: string): MiddlewareHandler {
  return staticAsset(file, "public, max-age=31536000, immutable");
}

function staticAsset(file: string, cacheControl: string): MiddlewareHandler {
  return serveStatic({
    root: "/",
    path: file,
    onFound: (_path, c) => {
      c.header("Cache-Control", cacheControl);
    },
  });
}

function Header({ locale }: { locale: ArchiveLocale }) {
  const alternate = otherLocale(locale);
  return (
    <header class="masthead">
      <div class="shell masthead__inner">
        <a class="wordmark" href={`/${locale}/`} translate="no">Fuscabot Archive</a>
        <div class="masthead__actions">
          <nav class="locale-nav" aria-label="Language">
            <span aria-current="page">{copy[locale].language}</span>
            <a href={`/${alternate}/`} lang={alternate}>{copy[locale].alternateLanguage}</a>
          </nav>
          <div
            class="theme-control-mount"
            data-theme-control
            data-label={copy[locale].theme}
            data-light={copy[locale].lightTheme}
            data-dark={copy[locale].darkTheme}
          />
        </div>
      </div>
    </header>
  );
}

function ArchivePage(props: {
  locale: ArchiveLocale;
  items: readonly PublicArchiveItem[];
  tags: readonly { slug: string; label: string }[];
  total: number;
  page: number;
  totalPages: number;
  query?: string;
  tag?: string;
}) {
  const text = copy[props.locale];
  return (
    <main id="main" class="shell">
      <section class="hero" aria-labelledby="archive-title">
        <p class="eyebrow">{props.locale === "en" ? "Public field notes" : "Notas públicas"}</p>
        <h1 id="archive-title">Fuscabot Archive</h1>
        <p class="subtitle">{text.subtitle}</p>
      </section>
      <form class="filters" action={`/${props.locale}/`} method="get" role="search">
        <div class="field">
          <label for="archive-query">{text.search}</label>
          <input
            id="archive-query"
            name="q"
            type="search"
            maxlength={100}
            value={props.query ?? ""}
            autocomplete="off"
            placeholder={`${text.searchPlaceholder}…`}
          />
        </div>
        <div class="field">
          <label for="archive-tag">{text.tag}</label>
          <select id="archive-tag" name="tag">
            <option value="">{text.allTags}</option>
            {props.tags.map((tag) => (
              <option key={tag.slug} value={tag.slug} selected={tag.slug === props.tag}>
                {tag.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">{text.apply}</button>
      </form>
      <p class="result-count" aria-live="polite">
        {props.total} {props.total === 1 ? text.result : text.results}
      </p>
      {props.items.length
        ? (
          <ol class="results">
            {props.items.map((item) => (
              <ArchiveCard key={item.slug} locale={props.locale} item={item} />
            ))}
          </ol>
        )
        : <p class="empty">{text.empty}</p>}
      <Pagination
        locale={props.locale}
        page={props.page}
        totalPages={props.totalPages}
        query={props.query}
        tag={props.tag}
      />
    </main>
  );
}

function ArchiveCard({ locale, item }: { locale: ArchiveLocale; item: PublicArchiveItem }) {
  const text = copy[locale];
  return (
    <li class="card">
      <p class="meta">
        <time datetime={item.publishedAt.toISOString()}>
          {formatDate(item.publishedAt, locale)}
        </time>
      </p>
      <article class="card__body">
        <h2 class="card__title">
          <a href={`/${locale}/links/${encodeURIComponent(item.slug)}`}>{item.title}</a>
        </h2>
        {item.summary ? <p class="summary">{item.summary}</p> : null}
        <p class="meta card__source">
          <span>{item.sourceDomain}</span>
          <a
            class="card__source-link"
            href={item.outboundUrl}
            aria-label={`${text.open}: ${item.sourceDomain}`}
            rel="noopener noreferrer external"
            data-umami-event="outbound-link"
            data-umami-event-source-domain={item.sourceDomain}
          >
            ↗
          </a>
        </p>
        <TagList locale={locale} tags={item.tags} />
      </article>
    </li>
  );
}

function DetailPage({ locale, item }: { locale: ArchiveLocale; item: PublicArchiveItem }) {
  const text = copy[locale];
  return (
    <main id="main" class="shell">
      <p>
        <a class="back-link" href={`/${locale}/`}>
          <span class="back-link__icon" aria-hidden="true">←</span>
          <span>{text.back}</span>
        </a>
      </p>
      <article class="detail">
        <p class="eyebrow">{item.sourceDomain}</p>
        <h1>{item.title}</h1>
        <dl class="detail__dates meta">
          <div>
            <dt>{text.published}</dt>
            <dd>
              <time datetime={item.publishedAt.toISOString()}>
                {formatDate(item.publishedAt, locale)}
              </time>
            </dd>
          </div>
          {!isSameUtcDate(item.publishedAt, item.updatedAt)
            ? (
              <div>
                <dt>{text.updated}</dt>
                <dd>
                  <time datetime={item.updatedAt.toISOString()}>
                    {formatDate(item.updatedAt, locale)}
                  </time>
                </dd>
              </div>
            )
            : null}
        </dl>
        {item.summary ? <p class="subtitle">{item.summary}</p> : null}
        {item.selectedText ? <blockquote>{item.selectedText}</blockquote> : null}
        <TagList locale={locale} tags={item.tags} />
        <a
          class="source-link"
          href={item.outboundUrl}
          rel="noopener noreferrer external"
          data-umami-event="outbound-link"
          data-umami-event-source-domain={item.sourceDomain}
        >
          {text.open} ↗
        </a>
      </article>
    </main>
  );
}

function TagList(
  { locale, tags }: {
    locale: ArchiveLocale;
    tags: readonly { slug: string; label: string }[];
  },
) {
  return tags.length
    ? (
      <div class="tags">
        {tags.map((tag) => (
          <a key={tag.slug} class="tag" href={`/${locale}/?tag=${encodeURIComponent(tag.slug)}`}>
            {tag.label}
          </a>
        ))}
      </div>
    )
    : null;
}

function Pagination(props: {
  locale: ArchiveLocale;
  page: number;
  totalPages: number;
  query?: string;
  tag?: string;
}) {
  if (props.totalPages <= 1) return null;
  const text = copy[props.locale];
  return (
    <nav class="pagination" aria-label={`${text.page} ${props.page} / ${props.totalPages}`}>
      {props.page > 1
        ? (
          <a rel="prev" href={pageUrl(props.locale, props.page - 1, props.query, props.tag)}>
            ← {text.newer}
          </a>
        )
        : <span />}
      <span>{text.page} {props.page} / {props.totalPages}</span>
      {props.page < props.totalPages
        ? (
          <a rel="next" href={pageUrl(props.locale, props.page + 1, props.query, props.tag)}>
            {text.older} →
          </a>
        )
        : <span />}
    </nav>
  );
}

function renderError(
  c: Context,
  locale: ArchiveLocale,
  origin: string,
  analytics: UmamiOptions | undefined,
  status: 400 | 404 | 500,
) {
  const missing = status === 404;
  const title = missing ? copy[locale].notFoundTitle : copy[locale].invalidTitle;
  const body = missing ? copy[locale].notFoundBody : copy[locale].invalidBody;
  c.status(status);
  c.header("Cache-Control", "no-store");
  return c.html(
    <Document
      locale={locale}
      origin={origin}
      analytics={analytics}
      title={`${title} — Fuscabot Archive`}
      description={body}
      canonical={`${origin}/${locale}/`}
      alternatePath={`/${otherLocale(locale)}/`}
    >
      <main id="main" class="shell error">
        <p class="eyebrow">{status}</p>
        <h1>{title}</h1>
        <p>{body}</p>
        <p>
          <a href={`/${locale}/`}>← {copy[locale].back}</a>
        </p>
      </main>
    </Document>,
  );
}

function responsePolicy(analytics?: UmamiOptions): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const analyticsOrigin = analytics ? new URL(analytics.scriptUrl).origin : undefined;
    const analyticsHost = analytics ? umamiCollectionOrigin(analytics) : undefined;
    const scriptSrc = analyticsOrigin ? `'self' ${analyticsOrigin}` : "'self'";
    const connectSrc = analyticsHost ? `'self' ${analyticsHost}` : "'self'";
    c.header(
      "Content-Security-Policy",
      `default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; script-src ${scriptSrc}; connect-src ${connectSrc}`,
    );
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Content-Type-Options", "nosniff");
    if (!c.res.headers.has("Cache-Control")) {
      c.header("Cache-Control", "public, max-age=0, must-revalidate");
    }

    const type = c.res.headers.get("Content-Type") ?? "";
    if (c.res.status === 200 && /(?:text\/html|text\/plain|application\/xml)/.test(type)) {
      const body = await c.res.clone().arrayBuffer();
      const value = await etag(body);
      c.header("ETag", value);
      if (c.req.header("If-None-Match") === value) {
        c.res = new Response(null, { status: 304, headers: c.res.headers });
      }
    }
  };
}

function umamiCollectionOrigin(analytics: UmamiOptions): string {
  if (analytics.hostUrl) return new URL(analytics.hostUrl).origin;
  const scriptOrigin = new URL(analytics.scriptUrl).origin;
  return scriptOrigin === "https://cloud.umami.is" ? "https://gateway.umami.is" : scriptOrigin;
}

function parseListQuery(url: string):
  | { ok: true; value: { query?: string; tag?: string; page: number } }
  | { ok: false } {
  const params = new URL(url).searchParams;
  if ([...params.keys()].some((key) => !["q", "tag", "page"].includes(key))) return { ok: false };
  if (["q", "tag", "page"].some((key) => params.getAll(key).length > 1)) return { ok: false };
  const rawQuery = params.get("q");
  const query = rawQuery?.trim() || undefined;
  const tag = params.get("tag")?.trim() || undefined;
  const rawPage = params.get("page") ?? "1";
  if (
    (query && query.length > 100) || (tag && !TAG_PATTERN.test(tag)) || !/^[1-9]\d*$/.test(rawPage)
  ) {
    return { ok: false };
  }
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page)) return { ok: false };
  return { ok: true, value: { query, tag, page } };
}

function pageUrl(
  locale: ArchiveLocale,
  page: number,
  query?: string,
  tag?: string,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const suffix = params.size ? `?${params}` : "";
  return `/${locale}/${suffix}`;
}

function archiveUrl(
  origin: string,
  locale: ArchiveLocale,
  query: { query?: string; tag?: string; page: number },
): string {
  return `${origin}${pageUrl(locale, query.page, query.query, query.tag)}`;
}

function validateOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    url.pathname !== "/"
  ) {
    throw new TypeError("Public site origin must be a credential-free HTTP(S) origin");
  }
  return url.origin;
}

function validateUmami(value?: UmamiOptions): UmamiOptions | undefined {
  if (!value) return undefined;
  const script = new URL(value.scriptUrl);
  const host = value.hostUrl ? new URL(value.hostUrl) : undefined;
  if (
    script.protocol !== "https:" || script.username || script.password || !value.websiteId.trim() ||
    !/^[a-z0-9.-]+$/i.test(value.domain) ||
    (host && (host.protocol !== "https:" || host.username || host.password))
  ) {
    throw new TypeError("Invalid Umami configuration");
  }
  return {
    ...value,
    scriptUrl: script.href,
    websiteId: value.websiteId.trim(),
    hostUrl: host?.origin,
  };
}

function safeOutboundUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function preferredLocale(header?: string): ArchiveLocale {
  if (!header) return "en";
  const preferences = header.split(",").map((entry, index) => {
    const [language, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.find((part) => part.trim().startsWith("q="));
    const parsed = quality ? Number(quality.trim().slice(2)) : 1;
    return { language, quality: Number.isFinite(parsed) ? parsed : 0, index };
  }).sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences.some(({ language, quality }) =>
      quality > 0 && (language === "pt-br" || language.startsWith("pt-br-"))
    )
    ? "pt-br"
    : "en";
}

function localeFromPath(path: string): ArchiveLocale {
  return path === "/pt-br" || path.startsWith("/pt-br/") ? "pt-br" : "en";
}

function otherLocale(locale: ArchiveLocale): ArchiveLocale {
  return locale === "en" ? "pt-br" : "en";
}

function formatDate(value: Date, locale: ArchiveLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function isSameUtcDate(left: Date, right: Date): boolean {
  return left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate();
}

function metaDescription(value: string): string {
  const compact = value.replaceAll(/\s+/g, " ").trim();
  return compact.length <= 160 ? compact : `${compact.slice(0, 159).trimEnd()}…`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function etag(body: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", body);
  return `"${
    Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
  }"`;
}
