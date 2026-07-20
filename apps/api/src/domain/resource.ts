import { z } from "zod";

export const CaptureSchema = z.object({
  captureId: z.string().uuid(),
  url: z.string().url(),
  canonicalUrl: z.string().url().nullable().optional(),
  title: z.string().trim().min(1).max(1000),
  description: z.string().max(5000).nullable().optional(),
  selectedQuote: z.string().max(10000).nullable().optional(),
  siteName: z.string().max(500).nullable().optional(),
  author: z.string().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sourceLanguage: z.string().max(32).default("unknown"),
  outputLanguage: z.enum(["pt-BR", "en"]).default("pt-BR"),
});

export const ResourcePatchSchema = z.object({
  title: z.string().trim().min(1).max(1000).optional(),
  summary: z.string().max(10000).nullable().optional(),
  whyUseful: z.string().max(10000).nullable().optional(),
  personalNote: z.string().max(10000).nullable().optional(),
  selectedQuote: z.string().max(10000).nullable().optional(),
  outputLanguage: z.enum(["pt-BR", "en"]).optional(),
  archived: z.boolean().optional(),
}).strict();

export type CaptureInput = z.infer<typeof CaptureSchema>;
export type ResourcePatch = z.infer<typeof ResourcePatchSchema>;

export type Resource = {
  id: string;
  workspaceId: string;
  originalUrl: string;
  normalizedUrl: string;
  canonicalUrl: string | null;
  canonicalUrlKey: string;
  sourceDomain: string;
  sourceLanguage: string;
  outputLanguage: "pt-BR" | "en";
  title: string;
  description: string | null;
  siteName: string | null;
  author: string | null;
  imageUrl: string | null;
  selectedQuote: string | null;
  summary: string | null;
  whyUseful: string | null;
  personalNote: string | null;
  enrichmentStatus: "preparing" | "ready" | "failed";
  enrichmentError: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
