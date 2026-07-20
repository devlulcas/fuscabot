import type { Resource, ResourcePatch } from "../domain/resource.ts";

export type ResourceQuery = {
  search?: string;
  archived?: boolean;
  domain?: string;
  enrichmentStatus?: "preparing" | "ready" | "failed";
  tag?: string;
  state?: "inbox" | "read_later" | "shared" | "archived";
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
  delete(workspaceId: string, id: string): Promise<boolean>;
}

export class InMemoryResourceRepository implements ResourceRepository {
  #resources = new Map<string, Resource>();

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
      .filter((r) => query.archived === undefined || Boolean(r.archivedAt) === query.archived)
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
    const { archived, tagSlugs: _tagSlugs, ...fields } = patch;
    const updated = {
      ...current,
      ...fields,
      archivedAt: archived === undefined
        ? current.archivedAt
        : archived
        ? new Date().toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    };
    this.#resources.set(id, updated);
    return Promise.resolve(updated);
  }
  delete(workspaceId: string, id: string) {
    const current = this.#resources.get(id);
    return Promise.resolve(
      current?.workspaceId === workspaceId ? this.#resources.delete(id) : false,
    );
  }
}
