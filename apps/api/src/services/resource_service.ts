import type { CaptureInput, Resource, ResourcePatch } from "../domain/resource.ts";
import { canonicalizeUrl } from "@fuscabot/contracts";
import type { ResourceQuery, ResourceRepository } from "../repositories/resource_repository.ts";

export class ResourceService {
  constructor(
    private repository: ResourceRepository,
    private workspaceId = "00000000-0000-4000-8000-000000000001",
  ) {}

  async capture(input: CaptureInput): Promise<{ resource: Resource; created: boolean }> {
    const byCaptureId = await this.repository.findById(input.captureId);
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
      whyUseful: null,
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
    return this.repository.findById(id);
  }
  list(query: ResourceQuery) {
    return this.repository.list(this.workspaceId, query);
  }
  patch(id: string, patch: ResourcePatch) {
    return this.repository.update(id, patch);
  }
  delete(id: string) {
    return this.repository.delete(id);
  }
}
