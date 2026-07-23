import { type BulkResourceAction, tagSlug } from "@fuscabot/contracts";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { deliveries, resources, resourceTags, tagAliases, tagLabels, tags } from "../db/schema.ts";
import type { Resource, ResourcePatch } from "../domain/resource.ts";
import type { ResourceQuery, ResourceRepository } from "./resource_repository.ts";

export class PostgresResourceRepository implements ResourceRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly publicSiteOrigin = "https://fuscabot.xyz",
  ) {}

  async findById(workspaceId: string, id: string): Promise<Resource | null> {
    const rows = await this.load(
      and(eq(resources.workspaceId, workspaceId), eq(resources.id, id)),
      1,
    );
    return rows[0] ?? null;
  }

  async findByCanonicalKey(workspaceId: string, key: string): Promise<Resource | null> {
    const rows = await this.load(
      and(
        eq(resources.workspaceId, workspaceId),
        eq(resources.canonicalUrlKey, key),
      ),
      1,
    );
    return rows[0] ?? null;
  }

  async create(resource: Resource): Promise<Resource> {
    await this.db.insert(resources).values(toInsert(resource)).onConflictDoNothing({
      target: [resources.workspaceId, resources.canonicalUrlKey],
    });
    const persisted = await this.findByCanonicalKey(resource.workspaceId, resource.canonicalUrlKey);
    if (!persisted) throw new Error("Created resource could not be loaded");
    return persisted;
  }

  async list(workspaceId: string, query: ResourceQuery): Promise<Resource[]> {
    const predicates = [eq(resources.workspaceId, workspaceId)];
    if (query.visibility === "public") predicates.push(isNotNull(resources.publicPublishedAt));
    if (query.visibility === "private") predicates.push(isNull(resources.publicPublishedAt));
    if (query.domain) predicates.push(eq(resources.sourceDomain, query.domain));
    if (query.enrichmentStatus) {
      predicates.push(eq(resources.enrichmentStatus, query.enrichmentStatus));
    }
    if (query.tag) {
      predicates.push(exists(
        this.db.select({ resourceId: resourceTags.resourceId }).from(resourceTags)
          .innerJoin(tags, eq(tags.id, resourceTags.tagId))
          .leftJoin(tagLabels, eq(tagLabels.tagId, tags.id))
          .leftJoin(tagAliases, eq(tagAliases.tagId, tags.id))
          .where(and(
            eq(resourceTags.resourceId, resources.id),
            or(
              eq(tags.slug, query.tag),
              eq(tagLabels.name, query.tag),
              eq(tagAliases.aliasNormalized, query.tag),
            ),
          )),
      ));
    }
    if (query.state === "inbox") {
      predicates.push(notExists(
        this.db.select({ resourceId: deliveries.resourceId }).from(deliveries).where(and(
          eq(deliveries.resourceId, resources.id),
          eq(deliveries.status, "sent"),
        )),
      ));
    }
    if (query.state === "shared" || query.state === "read_later") {
      const kind = query.state === "shared" ? "share" : "read_later";
      predicates.push(exists(
        this.db.select({ resourceId: deliveries.resourceId }).from(deliveries).where(and(
          eq(deliveries.resourceId, resources.id),
          eq(deliveries.status, "sent"),
          eq(deliveries.deliveryKind, kind),
        )),
      ));
    }
    const term = query.search?.trim();
    if (term) {
      const pattern = `%${escapeLike(term)}%`;
      predicates.push(
        or(
          // Drizzle has no query-builder operator for PostgreSQL tsvector @@ tsquery.
          sql<boolean>`${sql.identifier("resources")}.${sql.identifier("search_document")}
            @@ websearch_to_tsquery('simple', ${term})`,
          ilike(resources.title, pattern),
          ilike(resources.originalUrl, pattern),
          ilike(resources.sourceDomain, pattern),
          ilike(resources.summary, pattern),
          ilike(resources.personalNote, pattern),
          ilike(resources.selectedQuote, pattern),
          exists(
            this.db.select({ resourceId: resourceTags.resourceId }).from(resourceTags)
              .innerJoin(tags, eq(tags.id, resourceTags.tagId))
              .leftJoin(tagLabels, eq(tagLabels.tagId, tags.id))
              .leftJoin(tagAliases, eq(tagAliases.tagId, tags.id))
              .where(and(
                eq(resourceTags.resourceId, resources.id),
                or(
                  ilike(tags.slug, pattern),
                  ilike(tagLabels.name, pattern),
                  ilike(tagAliases.aliasNormalized, pattern),
                ),
              )),
          ),
        )!,
      );
    }
    const order = query.sort === "oldest"
      ? asc(resources.createdAt)
      : query.sort === "updated"
      ? desc(resources.updatedAt)
      : desc(resources.createdAt);
    const rows = await this.db.select().from(resources).where(and(...predicates)).orderBy(order)
      .limit(query.limit).offset(query.offset);
    return await this.hydrate(rows);
  }

  async publish(workspaceId: string, id: string, slug: string): Promise<Resource | null> {
    const publishedId = await this.db.transaction(async (tx) => {
      const [current] = await tx.select({
        id: resources.id,
        publicSlug: resources.publicSlug,
        publicPublishedAt: resources.publicPublishedAt,
      }).from(resources).where(and(
        eq(resources.workspaceId, workspaceId),
        eq(resources.id, id),
      )).for("update").limit(1);
      if (!current) return null;
      await tx.update(resources).set({
        publicSlug: current.publicSlug ?? slug,
        publicPublishedAt: current.publicPublishedAt ?? new Date(),
        updatedAt: new Date(),
      }).where(eq(resources.id, current.id));
      return current.id;
    });
    return publishedId ? await this.findById(workspaceId, publishedId) : null;
  }

  async unpublish(workspaceId: string, id: string): Promise<Resource | null> {
    const [row] = await this.db.update(resources).set({
      publicPublishedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(resources.workspaceId, workspaceId),
      eq(resources.id, id),
    )).returning({ id: resources.id });
    return row ? await this.findById(workspaceId, row.id) : null;
  }

  async update(workspaceId: string, id: string, patch: ResourcePatch): Promise<Resource | null> {
    const exists = await this.db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: resources.id }).from(resources).where(and(
        eq(resources.workspaceId, workspaceId),
        eq(resources.id, id),
      )).for("update").limit(1);
      if (!owned) return false;
      const update = toPatch(patch);
      if (Object.keys(update).length) {
        await tx.update(resources).set({ ...update, updatedAt: new Date() }).where(and(
          eq(resources.workspaceId, workspaceId),
          eq(resources.id, id),
        ));
      }
      if (patch.tagSlugs) {
        const requestedSlugs = [
          ...new Set(patch.tagSlugs.map(tagSlug).filter(Boolean)),
        ];
        await tx.delete(resourceTags).where(eq(resourceTags.resourceId, id));
        if (requestedSlugs.length) {
          const created = await tx.insert(tags).values(
            requestedSlugs.map((slug) => ({ workspaceId, slug })),
          ).onConflictDoNothing({
            target: [tags.workspaceId, tags.slug],
          }).returning({ id: tags.id, slug: tags.slug });
          if (created.length) {
            const labels: Array<typeof tagLabels.$inferInsert> = created.flatMap((tag) => [
              { tagId: tag.id, language: "en", name: tag.slug },
              { tagId: tag.id, language: "pt-BR", name: tag.slug },
            ]);
            await tx.insert(tagLabels).values(labels).onConflictDoNothing();
          }
          const selected = await tx.select({ id: tags.id }).from(tags).where(and(
            eq(tags.workspaceId, workspaceId),
            inArray(tags.slug, requestedSlugs),
          ));
          const links: Array<typeof resourceTags.$inferInsert> = selected.map((tag) => ({
            resourceId: id,
            tagId: tag.id,
            source: "user",
          }));
          await tx.insert(resourceTags).values(links).onConflictDoNothing();
        }
      }
      return true;
    });
    return exists ? await this.findById(workspaceId, id) : null;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db.delete(resources).where(and(
      eq(resources.workspaceId, workspaceId),
      eq(resources.id, id),
    )).returning({ id: resources.id });
    return rows.length === 1;
  }

  async bulkAction(
    workspaceId: string,
    ids: string[],
    action: BulkResourceAction["action"],
  ): Promise<string[] | null> {
    return await this.db.transaction(async (tx) => {
      const owned = await tx.select({ id: resources.id }).from(resources).where(and(
        eq(resources.workspaceId, workspaceId),
        inArray(resources.id, ids),
      )).for("update");
      if (owned.length !== ids.length) return null;
      if (action === "delete") {
        await tx.delete(resources).where(and(
          eq(resources.workspaceId, workspaceId),
          inArray(resources.id, ids),
        ));
      }
      return [...ids];
    });
  }

  private async load(predicate: ReturnType<typeof and>, limit: number): Promise<Resource[]> {
    return await this.hydrate(await this.db.select().from(resources).where(predicate).limit(limit));
  }

  private async hydrate(rows: Array<typeof resources.$inferSelect>): Promise<Resource[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const links = await this.db.query.resourceTags.findMany({
      where: inArray(resourceTags.resourceId, ids),
      with: {
        tag: {
          with: {
            labels: true,
            aliases: true,
          },
        },
      },
    });
    return rows.map((row) =>
      mapResource(
        row,
        this.publicSiteOrigin,
        links.filter((link) => link.resourceId === row.id).map(
          (link) => ({
            slug: link.tag.slug,
            labels: link.tag.labels.map((label) => ({
              language: label.language,
              name: label.name,
            })),
            aliases: link.tag.aliases.map((alias) => alias.aliasNormalized),
            source: link.source,
          }),
        ),
      )
    );
  }
}

function toInsert(resource: Resource): typeof resources.$inferInsert {
  return {
    id: resource.id,
    workspaceId: resource.workspaceId,
    originalUrl: resource.originalUrl,
    normalizedUrl: resource.normalizedUrl,
    canonicalUrl: resource.canonicalUrl,
    canonicalUrlKey: resource.canonicalUrlKey,
    sourceDomain: resource.sourceDomain,
    sourceLanguage: resource.sourceLanguage,
    outputLanguage: resource.outputLanguage,
    title: resource.title,
    description: resource.description,
    siteName: resource.siteName,
    author: resource.author,
    publishedAtSource: date(resource.publishedAtSource),
    imageUrl: resource.imageUrl,
    selectedQuote: resource.selectedQuote,
    summary: resource.summary,
    personalNote: resource.personalNote,
    enrichmentStatus: resource.enrichmentStatus,
    enrichmentError: resource.enrichmentError,
    publicSlug: resource.publicPublication?.slug ?? null,
    publicPublishedAt: date(resource.publicPublication?.publishedAt ?? null),
    createdAt: new Date(resource.createdAt),
    updatedAt: new Date(resource.updatedAt),
  };
}

function toPatch(patch: ResourcePatch): Partial<typeof resources.$inferInsert> {
  return {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.summary === undefined ? {} : { summary: patch.summary }),
    ...(patch.personalNote === undefined ? {} : { personalNote: patch.personalNote }),
    ...(patch.selectedQuote === undefined ? {} : { selectedQuote: patch.selectedQuote }),
    ...(patch.outputLanguage === undefined ? {} : { outputLanguage: patch.outputLanguage }),
  };
}

function mapResource(
  row: typeof resources.$inferSelect,
  publicSiteOrigin: string,
  resourceTags: Resource["tags"],
): Resource {
  return {
    ...row,
    outputLanguage: row.outputLanguage,
    enrichmentStatus: row.enrichmentStatus,
    publishedAtSource: iso(row.publishedAtSource),
    publicPublication: row.publicSlug && row.publicPublishedAt
      ? {
        slug: row.publicSlug,
        publishedAt: row.publicPublishedAt.toISOString(),
        url: `${publicSiteOrigin}/${
          row.outputLanguage === "pt-BR" ? "pt-br" : "en"
        }/links/${row.publicSlug}`,
      }
      : null,
    tags: resourceTags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function date(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
