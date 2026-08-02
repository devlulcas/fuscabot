import { redirect } from "@sveltejs/kit";
import { preferredLocale } from "$lib/archive.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ request, setHeaders }) => {
  setHeaders({ "vary": "Accept-Language", "cache-control": "no-store" });
  redirect(302, `/${preferredLocale(request.headers.get("accept-language"))}/`);
};
