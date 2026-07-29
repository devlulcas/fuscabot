import type { CanonicalTag } from "../../../../shared/api.ts";

export type TagInput = {
  slug: string;
  english: string;
  portuguese: string;
  aliases: string[];
};

export type { CanonicalTag };
