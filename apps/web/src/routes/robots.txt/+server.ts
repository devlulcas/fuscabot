import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) =>
  new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
