export type ResourcePatch = {
  title: string;
  summary: string | null;
  personalNote: string | null;
  selectedQuote: string | null;
  tagSlugs: string[];
};
