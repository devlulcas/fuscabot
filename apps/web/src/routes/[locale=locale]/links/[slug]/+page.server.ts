import { error } from "@sveltejs/kit";
import { safeOutboundUrl, SLUG_PATTERN } from "$lib/archive.ts";
import type { ArchiveLocale } from "$lib/archive.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const locale = params.locale as ArchiveLocale;
  if (!SLUG_PATTERN.test(params.slug)) error(404, "Archive item not found");
  const item = await locals.backend.archive.getBySlug(params.slug, locale);
  if (!item || !safeOutboundUrl(item.outboundUrl)) error(404, "Archive item not found");
  setHeaders({ "cache-control": "public, max-age=0, must-revalidate" });
  return { locale, item, origin: url.origin };
};
