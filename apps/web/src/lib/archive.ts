export type ArchiveLocale = "en" | "pt-br";

export const PAGE_SIZE = 20;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ListQuery = {
  query?: string;
  tag?: string;
  page: number;
};

export function parseListQuery(params: URLSearchParams): ListQuery | null {
  if ([...params.keys()].some((key) => !["q", "tag", "page"].includes(key))) return null;
  if (["q", "tag", "page"].some((key) => params.getAll(key).length > 1)) return null;

  const query = params.get("q")?.trim() || undefined;
  const tag = params.get("tag")?.trim() || undefined;
  const rawPage = params.get("page") ?? "1";
  if (
    (query && query.length > 100) || (tag && !TAG_PATTERN.test(tag)) ||
    !/^[1-9]\d*$/.test(rawPage)
  ) return null;

  const page = Number(rawPage);
  return Number.isSafeInteger(page) ? { query, tag, page } : null;
}

export function pageUrl(locale: ArchiveLocale, input: ListQuery): string {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.tag) params.set("tag", input.tag);
  if (input.page > 1) params.set("page", String(input.page));
  return `${resolve("/[locale=locale]", { locale })}/${params.size ? `?${params}` : ""}`;
}

export function otherLocale(locale: ArchiveLocale): ArchiveLocale {
  return locale === "en" ? "pt-br" : "en";
}

export function localeFromPath(pathname: string): ArchiveLocale {
  return pathname === "/pt-br" || pathname.startsWith("/pt-br/") ? "pt-br" : "en";
}

export function preferredLocale(header: string | null): ArchiveLocale {
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

export function safeOutboundUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function metaDescription(value: string): string {
  const compact = value.replaceAll(/\s+/g, " ").trim();
  return compact.length <= 160 ? compact : `${compact.slice(0, 159).trimEnd()}…`;
}

export function isSameUtcDate(left: Date | string, right: Date | string): boolean {
  return new Date(left).toISOString().slice(0, 10) === new Date(right).toISOString().slice(0, 10);
}
import { resolve } from "$app/paths";
