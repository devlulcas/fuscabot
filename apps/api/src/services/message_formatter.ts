import type {
  DeliverySnapshot,
  DeliverySnapshotV2,
  DiscordMessagePayload,
  LegacyDeliverySnapshot,
} from "@fuscabot/contracts";
import type { Resource } from "../domain/resource.ts";

const EMBED_LIMIT = 6_000;
const SUMMARY_LIMIT = 2_800;
const FIELD_VALUE_LIMIT = 1_024;
const ACCENT_COLOR = 0x5865F2;

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  let sliced = value.slice(0, Math.max(0, max - 1)).trimEnd();
  const last = sliced.charCodeAt(sliced.length - 1);
  if (last >= 0xD800 && last <= 0xDBFF) sliced = sliced.slice(0, -1);
  return `${sliced}…`;
};

const labels = (language: Resource["outputLanguage"]) =>
  language === "pt-BR"
    ? {
      why: "Por que salvar?",
      note: "Sua nota",
      context: "Contexto selecionado",
      tags: "Tags",
      captured: "Capturado em",
      open: "Abrir link",
    }
    : {
      why: "Why save it?",
      note: "Your note",
      context: "Selected context",
      tags: "Tags",
      captured: "Captured",
      open: "Open link",
    };

export function formatDiscordSnapshot(
  resource: Resource,
  _kind: "share" | "read_later",
  destinationLabel: string | null = null,
): DeliverySnapshotV2 {
  const copy = labels(resource.outputLanguage);
  const title = truncate(resource.title, 256);
  const sourceDomain = truncate(resource.sourceDomain, 256);
  const safeDestination = destinationLabel ? truncate(destinationLabel, 100) : null;
  const date = new Intl.DateTimeFormat(resource.outputLanguage, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(resource.createdAt));
  const footer = truncate(
    `${copy.captured} ${date}${safeDestination ? ` • ${safeDestination}` : ""}`,
    256,
  );
  let remaining = EMBED_LIMIT - title.length - sourceDomain.length - footer.length;
  const summary = resource.summary
    ? truncate(resource.summary, Math.min(SUMMARY_LIMIT, remaining))
    : null;
  remaining -= summary?.length ?? 0;

  const fields: Array<{ name: string; value: string }> = [];
  const addField = (name: string, value: string, preferredLimit = FIELD_VALUE_LIMIT): void => {
    const budget = Math.min(preferredLimit, FIELD_VALUE_LIMIT, remaining - name.length);
    if (budget < 2) return;
    const safeValue = truncate(value, budget);
    if (!safeValue) return;
    fields.push({ name, value: safeValue });
    remaining -= name.length + safeValue.length;
  };

  const why = whyContent(resource.whyUseful, resource.personalNote, copy.note, 900);
  if (why) addField(copy.why, why, 900);
  if (resource.selectedQuote) {
    addField(copy.context, blockquote(resource.selectedQuote), 900);
  }
  if (resource.tags.length) {
    addField(
      copy.tags,
      resource.tags.slice(0, 8).map((tag) => tagPill(tag.slug)).join(" "),
      600,
    );
  }

  const payload: DiscordMessagePayload = {
    embeds: [{
      title,
      url: resource.originalUrl,
      author: { name: sourceDomain, url: resource.originalUrl },
      ...(summary ? { description: summary } : {}),
      ...(fields.length ? { fields } : {}),
      color: ACCENT_COLOR,
      footer: { text: footer },
      timestamp: resource.createdAt,
    }],
    components: [{
      type: 1,
      components: [{ type: 2, style: 5, label: copy.open, url: resource.originalUrl }],
    }],
    allowed_mentions: { parse: [] },
  };

  return {
    version: 2,
    title,
    url: resource.originalUrl,
    summary: resource.summary,
    whyUseful: resource.whyUseful,
    personalNote: resource.personalNote,
    selectedQuote: resource.selectedQuote,
    includeQuote: Boolean(resource.selectedQuote),
    tags: resource.tags.map((tag) => tag.slug).slice(0, 8),
    outputLanguage: resource.outputLanguage,
    sourceDomain,
    capturedAt: resource.createdAt,
    destinationLabel: safeDestination,
    payload,
  };
}

export function snapshotPayload(snapshot: DeliverySnapshot): DiscordMessagePayload {
  return "version" in snapshot ? structuredClone(snapshot.payload) : legacyPayload(snapshot);
}

function legacyPayload(value: LegacyDeliverySnapshot): DiscordMessagePayload {
  const copy = labels(value.outputLanguage);
  const title = truncate(value.title, 256);
  const description = value.summary ? truncate(value.summary, 4_096) : null;
  let remaining = EMBED_LIMIT - title.length - (description?.length ?? 0);
  const fields: Array<{ name: string; value: string }> = [];
  const addField = (name: string, content: string): void => {
    const budget = Math.min(1_024, remaining - name.length);
    if (budget < 2) return;
    const safeValue = truncate(content, budget);
    fields.push({ name, value: safeValue });
    remaining -= name.length + safeValue.length;
  };
  const useful = value.personalNote ?? value.whyUseful;
  if (useful) addField(copy.why, useful);
  if (value.includeQuote && value.selectedQuote) {
    addField(copy.context, blockquote(value.selectedQuote));
  }
  if (value.tags.length) {
    addField("Tags", value.tags.map(tagPill).join(" "));
  }
  return {
    embeds: [{
      title,
      url: value.url,
      ...(description ? { description } : {}),
      ...(fields.length ? { fields } : {}),
    }],
    components: [{
      type: 1,
      components: [{ type: 2, style: 5, label: copy.open, url: value.url }],
    }],
    allowed_mentions: { parse: [] },
  };
}

function tagPill(value: string): string {
  const safe = truncate(value.trim().replaceAll("`", "").replaceAll(/\s+/g, "-"), 80);
  return `\`#${safe}\``;
}

function blockquote(value: string): string {
  return `> ${value.trim().replaceAll("\n", "\n> ")}`;
}

function whyContent(
  whyUseful: string | null,
  personalNote: string | null,
  noteLabel: string,
  max: number,
): string {
  if (!whyUseful) return personalNote ? truncate(personalNote, max) : "";
  if (!personalNote) return truncate(whyUseful, max);
  const noteHeading = `\n\n**${noteLabel}**\n`;
  const firstBudget = Math.floor((max - noteHeading.length) / 2);
  const first = truncate(whyUseful, firstBudget);
  const note = truncate(personalNote, max - noteHeading.length - first.length);
  return `${first}${noteHeading}${note}`;
}
