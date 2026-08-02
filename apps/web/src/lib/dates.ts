import type { ArchiveLocale } from "./archive.ts";

export function formatArchiveDate(
  value: Date | string,
  locale: ArchiveLocale,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}
