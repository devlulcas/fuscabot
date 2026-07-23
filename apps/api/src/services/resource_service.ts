import type { CaptureInput, Resource, ResourcePatch } from "../domain/resource.ts";
import type { BulkResourceAction } from "@fuscabot/contracts";
import { canonicalizeUrl } from "@fuscabot/contracts";
import type { ResourceQuery, ResourceRepository } from "../repositories/resource_repository.ts";

export class ResourceService {
  constructor(
    private repository: ResourceRepository,
    private workspaceId = "00000000-0000-4000-8000-000000000001",
  ) {}

  async capture(input: CaptureInput): Promise<{ resource: Resource; created: boolean }> {
    const byCaptureId = await this.repository.findById(this.workspaceId, input.captureId);
    if (byCaptureId) return { resource: byCaptureId, created: false };
    const urls = canonicalizeUrl(input.url, input.metadata.canonicalUrl);
    const { canonicalUrl, canonicalUrlKey, normalizedUrl, sourceDomain } = urls;
    const duplicate = await this.repository.findByCanonicalKey(this.workspaceId, canonicalUrlKey);
    if (duplicate) return { resource: duplicate, created: false };
    const now = new Date().toISOString();
    const resource: Resource = {
      id: input.captureId,
      workspaceId: this.workspaceId,
      originalUrl: input.url,
      normalizedUrl,
      canonicalUrl,
      canonicalUrlKey,
      sourceDomain,
      sourceLanguage: input.metadata.sourceLanguage ?? "unknown",
      outputLanguage: input.outputLanguage,
      title: input.title,
      description: input.metadata.description,
      siteName: input.metadata.siteName,
      author: input.metadata.author,
      publishedAtSource: input.metadata.publishedAt,
      imageUrl: input.metadata.imageUrl,
      selectedQuote: input.selectedQuote ?? null,
      summary: null,
      personalNote: null,
      enrichmentStatus: "preparing",
      enrichmentError: null,
      publicPublication: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    return { resource: await this.repository.create(resource), created: true };
  }
  get(id: string) {
    return this.repository.findById(this.workspaceId, id);
  }
  list(query: ResourceQuery) {
    return this.repository.list(this.workspaceId, query);
  }
  patch(id: string, patch: ResourcePatch) {
    return this.repository.update(this.workspaceId, id, patch);
  }
  async publish(id: string): Promise<{ resource: Resource; created: boolean }> {
    const current = await this.get(id);
    if (!current) throw new ResourceNotFoundError();
    if (!current.title.trim() || !safeOutboundUrl(current.canonicalUrl ?? current.normalizedUrl)) {
      throw new PublicationEligibilityError();
    }
    if (current.publicPublication) return { resource: current, created: false };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const resource = await this.repository.publish(
          this.workspaceId,
          id,
          `${slugify(current.title)}-${randomSuffix()}`,
        );
        if (!resource) throw new ResourceNotFoundError();
        return { resource, created: true };
      } catch (cause) {
        if (!isUniqueViolation(cause) || attempt === 4) throw cause;
      }
    }
    throw new Error("Public slug allocation failed");
  }
  async unpublish(id: string): Promise<Resource> {
    const resource = await this.repository.unpublish(this.workspaceId, id);
    if (!resource) throw new ResourceNotFoundError();
    return resource;
  }
  delete(id: string) {
    return this.repository.delete(this.workspaceId, id);
  }
  async bulkAction(ids: string[], action: BulkResourceAction["action"]): Promise<string[]> {
    const affectedIds = await this.repository.bulkAction(this.workspaceId, ids, action);
    if (!affectedIds) throw new BulkResourceNotFoundError();
    return affectedIds;
  }
}

export class BulkResourceNotFoundError extends Error {
  constructor() {
    super("One or more resources could not be found");
    this.name = "BulkResourceNotFoundError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super("Resource not found");
    this.name = "ResourceNotFoundError";
  }
}

export class PublicationEligibilityError extends Error {
  constructor() {
    super("Publication requires a title and a safe HTTP(S) URL");
    this.name = "PublicationEligibilityError";
  }
}

function slugify(value: string): string {
  const slug = value.normalize("NFKD").replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")
    .slice(0, 140).replaceAll(/-$/g, "");
  return slug || "link";
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeOutboundUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function isUniqueViolation(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "code" in cause &&
    cause.code === "23505";
}
