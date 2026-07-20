export type BilingualTag = {
  slug: string;
  english: string;
  portuguese: string;
  aliases?: readonly string[];
};

/** Normalizes labels and aliases for accent-insensitive, bilingual lookup. */
export function normalizeTagTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tagSlug(value: string): string {
  return normalizeTagTerm(value).replaceAll(" ", "-");
}

export function buildTagAliasIndex(
  tags: readonly BilingualTag[],
): ReadonlyMap<string, BilingualTag> {
  const index = new Map<string, BilingualTag>();
  for (const tag of tags) {
    for (
      const term of [
        tag.slug,
        tag.english,
        tag.portuguese,
        ...(tag.aliases ?? []),
      ]
    ) {
      const normalized = normalizeTagTerm(term);
      const existing = index.get(normalized);
      if (existing !== undefined && existing.slug !== tag.slug) {
        throw new Error(`Tag alias collision: ${term}`);
      }
      index.set(normalized, tag);
    }
  }
  return index;
}

export function resolveTag(
  query: string,
  index: ReadonlyMap<string, BilingualTag>,
): BilingualTag | undefined {
  return index.get(normalizeTagTerm(query));
}
