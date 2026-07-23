import { z } from "zod";

const nonBlank = z.string().trim().min(1);
const nullableText = z.string().trim().min(1).nullable();
const httpUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" && url.password === "";
}, "Expected an HTTP(S) URL without credentials");

export const LanguageSchema = z.enum(["pt-BR", "en"]);
export type Language = z.infer<typeof LanguageSchema>;

export const EnrichmentStatusSchema = z.enum(["preparing", "ready", "failed"]);
export type EnrichmentStatus = z.infer<typeof EnrichmentStatusSchema>;

export const CaptureMetadataSchema = z.object({
  canonicalUrl: httpUrl.nullable().default(null),
  description: nullableText.default(null),
  siteName: nullableText.default(null),
  author: nullableText.default(null),
  publishedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  imageUrl: httpUrl.nullable().default(null),
  sourceLanguage: nonBlank.nullable().default(null),
});
export type CaptureMetadata = z.infer<typeof CaptureMetadataSchema>;

export const CaptureSchema = z.object({
  captureId: z.uuid(),
  url: httpUrl,
  title: nonBlank.max(1_000),
  selectedQuote: z.string().trim().min(1).max(10_000).nullable().default(null),
  linkText: z.string().trim().min(1).max(500).nullable().default(null),
  outputLanguage: LanguageSchema.default("pt-BR"),
  metadata: CaptureMetadataSchema.default({
    canonicalUrl: null,
    description: null,
    siteName: null,
    author: null,
    publishedAt: null,
    imageUrl: null,
    sourceLanguage: null,
  }),
});
export type Capture = z.infer<typeof CaptureSchema>;

export const ResourcePatchSchema = z.object({
  title: nonBlank.max(1_000).optional(),
  summary: z.string().max(10_000).nullable().optional(),
  personalNote: z.string().max(10_000).nullable().optional(),
  selectedQuote: z.string().max(10_000).nullable().optional(),
  outputLanguage: LanguageSchema.optional(),
  archived: z.boolean().optional(),
  tagSlugs: z.array(nonBlank.max(80)).max(20).optional(),
}).strict();
export type ResourcePatch = z.infer<typeof ResourcePatchSchema>;

export const BulkResourceActionSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Resource IDs must be unique",
      });
    }
  }),
  action: z.enum(["archive", "restore", "delete"]),
}).strict();
export type BulkResourceAction = z.infer<typeof BulkResourceActionSchema>;

export const BulkResourceActionResultSchema = z.object({
  action: BulkResourceActionSchema.shape.action,
  affectedIds: z.array(z.uuid()),
});
export type BulkResourceActionResult = z.infer<
  typeof BulkResourceActionResultSchema
>;

export const ProposedTagSchema = z.object({
  english: nonBlank,
  portuguese: nonBlank,
  aliases: z.array(nonBlank).max(12),
});
export type ProposedTag = z.infer<typeof ProposedTagSchema>;

export const ChannelSuggestionSchema = z.object({
  channelId: z.uuid().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: nonBlank.max(500),
}).superRefine((suggestion, context) => {
  if (suggestion.confidence === "low" && suggestion.channelId !== null) {
    context.addIssue({
      code: "custom",
      path: ["channelId"],
      message: "Low-confidence suggestions must not preselect a channel",
    });
  }
});

export const EnrichmentDraftSchema = z.object({
  summary: nonBlank.max(1_000),
  outputLanguage: LanguageSchema,
  suggestedTagSlugs: z.array(nonBlank.max(80)).max(8),
  proposedNewTags: z.array(ProposedTagSchema).max(5),
  channelSuggestion: ChannelSuggestionSchema,
  includeQuoteInDelivery: z.boolean(),
});
export type EnrichmentDraft = z.infer<typeof EnrichmentDraftSchema>;

export const TagLabelSchema = z.object({
  language: LanguageSchema,
  name: nonBlank.max(80),
});

export const ResourceTagSchema = z.object({
  slug: nonBlank.max(80),
  labels: z.array(TagLabelSchema).min(1).max(2),
  aliases: z.array(nonBlank.max(80)).max(30),
  source: z.enum(["ai", "user", "ai_confirmed"]),
});

export const ResourceSchema = z.object({
  id: z.uuid(),
  originalUrl: httpUrl,
  normalizedUrl: httpUrl,
  canonicalUrl: httpUrl.nullable(),
  canonicalUrlKey: httpUrl,
  sourceDomain: nonBlank,
  sourceLanguage: nonBlank.default("unknown"),
  outputLanguage: LanguageSchema.default("pt-BR"),
  title: nonBlank,
  description: nullableText,
  siteName: nullableText,
  author: nullableText,
  publishedAtSource: z.iso.datetime({ offset: true }).nullable(),
  imageUrl: httpUrl.nullable(),
  selectedQuote: nullableText,
  summary: nullableText,
  personalNote: nullableText,
  enrichmentStatus: EnrichmentStatusSchema,
  enrichmentError: nullableText,
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
  tags: z.array(ResourceTagSchema),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const DeliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "failed",
  "unknown",
]);
export const DeliveryKindSchema = z.enum(["read_later", "share"]);

export const DiscordMessagePayloadSchema = z.object({
  content: nonBlank.max(2_000),
  allowed_mentions: z.object({ parse: z.tuple([]) }),
});
export type DiscordMessagePayload = z.infer<typeof DiscordMessagePayloadSchema>;

export const LegacyDeliverySnapshotSchema = z.object({
  title: nonBlank.max(256),
  url: httpUrl,
  summary: nullableText,
  personalNote: nullableText,
  selectedQuote: nullableText,
  includeQuote: z.boolean(),
  tags: z.array(nonBlank.max(80)).max(8),
  outputLanguage: LanguageSchema,
});
export type LegacyDeliverySnapshot = z.infer<
  typeof LegacyDeliverySnapshotSchema
>;

export const DeliverySnapshotV2Schema = LegacyDeliverySnapshotSchema.extend({
  version: z.literal(2),
  sourceDomain: nonBlank.max(256),
  capturedAt: z.iso.datetime({ offset: true }),
  destinationLabel: nonBlank.max(100).nullable(),
  payload: DiscordMessagePayloadSchema,
});
export type DeliverySnapshotV2 = z.infer<typeof DeliverySnapshotV2Schema>;

export const DeliverySnapshotSchema = z.union([
  DeliverySnapshotV2Schema,
  LegacyDeliverySnapshotSchema,
]);
export type DeliverySnapshot = z.infer<typeof DeliverySnapshotSchema>;

export const DeliverySchema = z.object({
  id: z.uuid(),
  resourceId: z.uuid(),
  destinationType: z.literal("discord_channel"),
  channelId: z.uuid(),
  deliveryKind: DeliveryKindSchema,
  messageSnapshot: DeliverySnapshotSchema,
  externalMessageId: nonBlank.nullable(),
  externalUrl: httpUrl.nullable(),
  status: DeliveryStatusSchema,
  error: nullableText,
  sentAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Delivery = z.infer<typeof DeliverySchema>;

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "PAYLOAD_TOO_LARGE",
  "DEPENDENCY_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: nonBlank,
    requestId: nonBlank.optional(),
    retryable: z.boolean().default(false),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
