import type { CanonicalTag } from "../api/tags.select.ts";

export type TagInput = {
  slug: string;
  english: string;
  portuguese: string;
  aliases: string[];
};

export type { CanonicalTag };
