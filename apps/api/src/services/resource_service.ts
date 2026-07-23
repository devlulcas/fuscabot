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
      archivedAt: null,
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
