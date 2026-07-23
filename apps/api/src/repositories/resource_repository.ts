import type { BulkResourceAction } from "@fuscabot/contracts";
import { tagSlug } from "@fuscabot/contracts";
import type { Resource, ResourcePatch } from "../domain/resource.ts";

export type ResourceQuery = {
  search?: string;
  domain?: string;
  enrichmentStatus?: "preparing" | "ready" | "failed";
  tag?: string;
  state?: "inbox" | "read_later" | "shared";
  visibility?: "public" | "private";
  sort?: "newest" | "oldest" | "updated";
  limit: number;
  offset: number;
};

export interface ResourceRepository {
  findById(workspaceId: string, id: string): Promise<Resource | null>;
  findByCanonicalKey(workspaceId: string, key: string): Promise<Resource | null>;
  create(resource: Resource): Promise<Resource>;
  list(workspaceId: string, query: ResourceQuery): Promise<Resource[]>;
  update(workspaceId: string, id: string, patch: ResourcePatch): Promise<Resource | null>;
  publish(workspaceId: string, id: string, slug: string): Promise<Resource | null>;
  unpublish(workspaceId: string, id: string): Promise<Resource | null>;
  delete(workspaceId: string, id: string): Promise<boolean>;
  bulkAction(
    workspaceId: string,
    ids: string[],
    action: BulkResourceAction["action"],
  ): Promise<string[] | null>;
}

export class InMemoryResourceRepository implements ResourceRepository {
  #resources = new Map<string, Resource>();
  #publicSlugs = new Map<string, string>();
  constructor(
    private readonly publicSiteOrigin = "https://fuscabot.xyz",
  ) {}

  findById(workspaceId: string, id: string) {
    const resource = this.#resources.get(id);
    return Promise.resolve(resource?.workspaceId === workspaceId ? resource : null);
  }
  findByCanonicalKey(workspaceId: string, key: string) {
    return Promise.resolve(
      [...this.#resources.values()].find((r) =>
        r.workspaceId === workspaceId && r.canonicalUrlKey === key
      ) ?? null,
    );
  }
  create(resource: Resource) {
    this.#resources.set(resource.id, resource);
    return Promise.resolve(resource);
  }
  list(workspaceId: string, query: ResourceQuery) {
    const search = query.search?.toLocaleLowerCase();
    const rows = [...this.#resources.values()].filter((r) => r.workspaceId === workspaceId)
      .filter((r) =>
        !query.visibility ||
        (query.visibility === "public") === (r.publicPublication !== null)
      )
      .filter((r) => !query.domain || r.sourceDomain === query.domain)
      .filter((r) => !query.enrichmentStatus || r.enrichmentStatus === query.enrichmentStatus)
      .filter((r) =>
        !query.tag ||
        r.tags.some((tag) =>
          tag.slug === query.tag || tag.labels.some((label) => label.name === query.tag) ||
          tag.aliases.includes(query.tag!)
        )
      )
      .filter((r) =>
        !search || [r.title, r.originalUrl, r.sourceDomain, r.summary, r.personalNote]
          .some((v) => v?.toLocaleLowerCase().includes(search))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(query.offset, query.offset + query.limit);
    return Promise.resolve(rows);
  }
  update(workspaceId: string, id: string, patch: ResourcePatch) {
    const current = this.#resources.get(id);
    if (!current || current.workspaceId !== workspaceId) return Promise.resolve(null);
    const { tagSlugs, ...fields } = patch;
    const nextTags = tagSlugs === undefined
      ? current.tags
      : [...new Set(tagSlugs.map(tagSlug).filter(Boolean))].map((slug) => ({
        slug,
        labels: [
          { language: "en" as const, name: slug },
          { language: "pt-BR" as const, name: slug },
        ],
        aliases: [],
        source: "user" as const,
      }));
    const updated = {
      ...current,
      ...fields,
      tags: nextTags,
      updatedAt: new Date().toISOString(),
    };
    this.#resources.set(id, updated);
    return Promise.resolve(updated);
  }
  publish(workspaceId: string, id: string, slug: string) {
    const current = this.#resources.get(id);
    if (!current || current.workspaceId !== workspaceId) return Promise.resolve(null);
    const publishedAt = current.publicPublication?.publishedAt ?? new Date().toISOString();
    const persistedSlug = current.publicPublication?.slug ?? this.#publicSlugs.get(id) ?? slug;
    this.#publicSlugs.set(id, persistedSlug);
    const updated = {
      ...current,
      publicPublication: {
        slug: persistedSlug,
        publishedAt,
        url: `${this.publicSiteOrigin}/${
          current.outputLanguage === "pt-BR" ? "pt-br" : "en"
        }/links/${persistedSlug}`,
      },
      updatedAt: new Date().toISOString(),
    };
    this.#resources.set(id, updated);
    return Promise.resolve(updated);
  }
  unpublish(workspaceId: string, id: string) {
    const current = this.#resources.get(id);
    if (!current || current.workspaceId !== workspaceId) return Promise.resolve(null);
    const updated = {
      ...current,
      publicPublication: null,
      updatedAt: new Date().toISOString(),
    };
    this.#resources.set(id, updated);
    return Promise.resolve(updated);
  }
  delete(workspaceId: string, id: string) {
    const current = this.#resources.get(id);
    if (current?.workspaceId !== workspaceId) return Promise.resolve(false);
    this.#publicSlugs.delete(id);
    return Promise.resolve(this.#resources.delete(id));
  }
  bulkAction(workspaceId: string, ids: string[], _action: BulkResourceAction["action"]) {
    const resources = ids.map((id) => this.#resources.get(id));
    if (resources.some((resource) => !resource || resource.workspaceId !== workspaceId)) {
      return Promise.resolve(null);
    }
    for (const resource of resources as Resource[]) {
      this.#resources.delete(resource.id);
      this.#publicSlugs.delete(resource.id);
    }
    return Promise.resolve([...ids]);
  }
}
