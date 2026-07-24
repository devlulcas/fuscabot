export type ArchiveDateLocale = "en" | "pt-br";

export function formatArchiveDate(
  value: Date | string,
  locale: ArchiveDateLocale,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "medium",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(asDate(value));
}

export function calendarDateKey(value: Date | string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).formatToParts(asDate(value));
  return parts
    .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
    .map((part) => `${part.type}:${part.value}`)
    .join("|");
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
