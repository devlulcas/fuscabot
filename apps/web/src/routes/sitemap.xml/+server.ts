import type { RequestHandler } from "./$types";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export const GET: RequestHandler = async ({ locals, url }) => {
  const items = await locals.backend.archive.listForSitemap();
  const entries = items.flatMap((item) =>
    (["en", "pt-br"] as const).map((locale) => {
      const location = `${url.origin}/${locale}/links/${encodeURIComponent(item.slug)}`;
      return `<url><loc>${escapeXml(location)}</loc><lastmod>${
        new Date(item.updatedAt).toISOString()
      }</lastmod></url>`;
    })
  ).join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
};
