import type {
  DeliverySnapshot,
  DeliverySnapshotV2,
  DiscordMessagePayload,
  LegacyDeliverySnapshot,
} from "@fuscabot/contracts";
import type { Resource } from "../domain/resource.ts";

const MESSAGE_LIMIT = 2_000;

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  let sliced = value.slice(0, Math.max(0, max - 1)).trimEnd();
  const last = sliced.charCodeAt(sliced.length - 1);
  if (last >= 0xD800 && last <= 0xDBFF) sliced = sliced.slice(0, -1);
  return `${sliced}…`;
};

export function formatDiscordSnapshot(
  resource: Resource,
  _kind: "share" | "read_later",
  destinationLabel: string | null = null,
): DeliverySnapshotV2 {
  const title = truncate(resource.title, 256);
  const sourceDomain = truncate(resource.sourceDomain, 256);
  const safeDestination = destinationLabel ? truncate(destinationLabel, 100) : null;

  const payload: DiscordMessagePayload = {
    content: markdownMessage({
      title,
      url: resource.originalUrl,
      linkLabel: sourceDomain,
      summary: resource.summary,
      selectedQuote: resource.selectedQuote,
      personalNote: resource.personalNote,
      tags: resource.tags.map((tag) => tag.slug).slice(0, 8),
    }),
    allowed_mentions: { parse: [] },
  };

  return {
    version: 2,
    title,
    url: resource.originalUrl,
    summary: resource.summary,
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
  return {
    content: markdownMessage({
      title: value.title,
      url: value.url,
      linkLabel: new URL(value.url).hostname,
      summary: value.summary,
      selectedQuote: value.includeQuote ? value.selectedQuote : null,
      personalNote: value.personalNote,
      tags: value.tags,
    }),
    allowed_mentions: { parse: [] },
  };
}

type MarkdownMessageInput = {
  title: string;
  url: string;
  linkLabel: string;
  summary: string | null;
  selectedQuote: string | null;
  personalNote: string | null;
  tags: string[];
};

function markdownMessage(input: MarkdownMessageInput): string {
  const title = `### ${truncate(singleLine(input.title), 256)}`;
  const link = `[${input.linkLabel}](${markdownUrl(input.url)})`;
  const optionalCount = [
    input.summary,
    input.selectedQuote,
    input.personalNote,
    input.tags.length ? "tags" : null,
  ].filter(Boolean).length;
  const budget = optionalCount
    ? Math.max(0, Math.floor((MESSAGE_LIMIT - title.length - link.length - 4) / optionalCount) - 4)
    : 0;
  const sections = [title];

  if (input.summary && budget) sections.push(truncate(singleLine(input.summary), budget));
  if (input.selectedQuote && budget) {
    const quote = truncate(singleLine(input.selectedQuote), Math.max(0, budget - 4));
    sections.push(`> "${quote}"`);
  }
  if (input.personalNote && budget) {
    sections.push(`_${truncate(singleLine(input.personalNote), Math.max(0, budget - 2))}_`);
  }
  if (input.tags.length && budget) {
    const tagLines: string[] = [];
    for (const tag of input.tags) {
      const line = `- ${truncate(tag.trim(), 80)}`;
      if (`Tags:\n${[...tagLines, line].join("\n")}`.length > budget) break;
      tagLines.push(line);
    }
    if (tagLines.length) sections.push(`Tags:\n${tagLines.join("\n")}`);
  }
  sections.push(link);
  return truncate(sections.join("\n\n"), MESSAGE_LIMIT);
}

function singleLine(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function markdownUrl(value: string): string {
  return value.replaceAll("(", "%28").replaceAll(")", "%29");
}
