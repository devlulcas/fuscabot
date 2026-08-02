import {
  type ApiRuntime,
  createApiRuntime,
  type PublicArchiveItem,
  type PublicArchiveReader,
} from "@fuscabot/api";
import { env } from "$env/dynamic/private";

const fixtureItem: PublicArchiveItem = {
  slug: "useful-link-a1b2c3d4",
  title: "A useful link",
  summary: "A concise field note for the public archive.",
  selectedText: "Useful things become easier to find when they are carefully described.",
  sourceDomain: "example.com",
  outboundUrl: "https://example.com/useful-link",
  tags: [{ slug: "design", label: "Design" }],
  publishedAt: new Date("2026-06-01T12:00:00Z"),
  updatedAt: new Date("2026-06-02T12:00:00Z"),
};

function fixtureArchive(): PublicArchiveReader {
  return {
    list: (input) => {
      const matches =
        (!input.query || fixtureItem.title.toLowerCase().includes(input.query.toLowerCase())) &&
        (!input.tag || input.tag === "design");
      return Promise.resolve({
        items: matches && input.page === 1 ? [fixtureItem] : [],
        total: matches ? 1 : 0,
        tags: [{ slug: "design", label: input.locale === "pt-br" ? "Projeto" : "Design" }],
      });
    },
    getBySlug: (slug, locale) =>
      Promise.resolve(
        slug === fixtureItem.slug
          ? {
            ...fixtureItem,
            tags: [{ slug: "design", label: locale === "pt-br" ? "Projeto" : "Design" }],
          }
          : null,
      ),
    listForSitemap: () =>
      Promise.resolve([{ slug: fixtureItem.slug, updatedAt: fixtureItem.updatedAt }]),
  };
}

function fixtureRuntime(): ApiRuntime {
  return {
    archive: fixtureArchive(),
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/health") return Response.json({ status: "ok" });
      if (url.pathname === "/v1/__e2e__/echo") {
        return Response.json({
          method: request.method,
          query: url.search,
          body: await request.text(),
          authorization: request.headers.get("authorization"),
        }, { status: 202, headers: { "x-api-fixture": "true" } });
      }
      return Response.json({
        error: { code: "NOT_FOUND", message: "Route not found", retryable: false },
      }, { status: 404, headers: { "x-request-id": crypto.randomUUID() } });
    },
  };
}

export const backend = env.WEB_E2E_FIXTURES === "1" ? fixtureRuntime() : createApiRuntime();
