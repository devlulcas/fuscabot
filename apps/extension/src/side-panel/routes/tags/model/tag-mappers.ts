import type { TagInput } from "./tag-types.ts";

export function tagInputFromForm(data: FormData): TagInput {
  return {
    slug: text(data, "slug"),
    english: text(data, "english"),
    portuguese: text(data, "portuguese"),
    aliases: text(data, "aliases").split(",").map((alias) => alias.trim())
      .filter(Boolean),
  };
}

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}
