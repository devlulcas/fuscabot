import { error } from "@sveltejs/kit";
import { PAGE_SIZE, parseListQuery } from "$lib/archive.ts";
import type { ArchiveLocale } from "$lib/archive.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const locale = params.locale as ArchiveLocale;
  const query = parseListQuery(url.searchParams);
  if (!query) error(400, "Invalid archive query");

  const result = await locals.backend.archive.list({ locale, ...query, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  if (query.page > totalPages && result.total > 0) error(400, "Invalid archive page");
  setHeaders({ "cache-control": "public, max-age=0, must-revalidate" });

  return { locale, query, result, totalPages, origin: url.origin };
};
