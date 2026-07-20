import type { MessageSnapshot } from "../domain/delivery.ts";
import type { Resource } from "../domain/resource.ts";

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

export function formatDiscordSnapshot(
  resource: Resource,
  kind: "share" | "read_later",
  tags: string[] = [],
): MessageSnapshot {
  const title = truncate(
    kind === "read_later" ? `Read later · ${resource.title}` : resource.title,
    256,
  );
  let remaining = 6000 - title.length;
  const summary = resource.summary ? truncate(resource.summary, Math.min(4096, remaining)) : null;
  remaining -= summary?.length ?? 0;
  const quote = resource.selectedQuote ? truncate(`“${resource.selectedQuote}”`, 1024) : null;
  const useful = resource.personalNote ?? resource.whyUseful;
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  const addField = (name: string, value: string) => {
    const budget = Math.min(1024, remaining - name.length);
    if (budget <= 0) return;
    const safeValue = truncate(value, budget);
    fields.push({ name, value: safeValue });
    remaining -= name.length + safeValue.length;
  };
  if (kind === "share" && useful) addField("Por que é útil", useful);
  if (quote) addField("Contexto", quote);
  if (kind === "share" && tags.length) {
    addField("Tags", tags.join(" · "));
  }
  const payload = {
    embeds: [{
      title,
      url: resource.originalUrl,
      ...(summary ? { description: summary } : {}),
      ...(fields.length ? { fields } : {}),
    }],
    allowed_mentions: { parse: [] },
  };
  return {
    kind,
    title: resource.title,
    url: resource.originalUrl,
    summary: resource.summary,
    whyUseful: resource.whyUseful,
    personalNote: resource.personalNote,
    selectedQuote: resource.selectedQuote,
    tags,
    payload,
  };
}
