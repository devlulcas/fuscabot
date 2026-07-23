import { type BulkResourceAction, tagSlug } from "@fuscabot/contracts";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQLWrapper,
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
      predicates.push(sql<boolean>`exists (
        select 1 from ${resourceTags} frt
        join ${tags} ft on ft.id = frt.tag_id
        left join ${tagLabels} ftl on ftl.tag_id = ft.id
        left join ${tagAliases} fta on fta.tag_id = ft.id
        where frt.resource_id = ${resources.id}
          and (ft.slug = ${query.tag} or ftl.name = ${query.tag} or fta.alias_normalized = ${query.tag})
      )`);
    }
    if (query.state === "inbox") {
      predicates.push(sql<boolean>`not exists (
        select 1 from ${deliveries} sd
        where sd.resource_id = ${resources.id} and sd.status = 'sent'
      )`);
    }
    if (query.state === "shared" || query.state === "read_later") {
      const kind = query.state === "shared" ? "share" : "read_later";
      predicates.push(sql<boolean>`exists (
        select 1 from ${deliveries} sd
        where sd.resource_id = ${resources.id} and sd.status = 'sent'
          and sd.delivery_kind = ${kind}
      )`);
    }
    const term = query.search?.trim();
    if (term) {
      const pattern = `%${escapeLike(term)}%`;
      predicates.push(
        or(
          sql<boolean>`${sql.identifier("resources")}.${sql.identifier("search_document")}
            @@ websearch_to_tsquery('simple', ${term})`,
          like(resources.title, pattern),
          like(resources.originalUrl, pattern),
          like(resources.sourceDomain, pattern),
          like(resources.summary, pattern),
          like(resources.personalNote, pattern),
          like(resources.selectedQuote, pattern),
          sql<boolean>`exists (
          select 1 from ${resourceTags} srt
          join ${tags} st on st.id = srt.tag_id
          left join ${tagLabels} stl on stl.tag_id = st.id
          left join ${tagAliases} sta on sta.tag_id = st.id
          where srt.resource_id = ${resources.id}
            and (st.slug ilike ${pattern} escape '\\'
              or stl.name ilike ${pattern} escape '\\'
              or sta.alias_normalized ilike ${pattern} escape '\\')
        )`,
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
    const [row] = await this.db.update(resources).set({
      publicSlug: sql`coalesce(${resources.publicSlug}, ${slug})`,
      publicPublishedAt: sql`coalesce(${resources.publicPublishedAt}, now())`,
      updatedAt: new Date(),
    }).where(and(
      eq(resources.workspaceId, workspaceId),
      eq(resources.id, id),
    )).returning({ id: resources.id });
    return row ? await this.findById(workspaceId, row.id) : null;
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
            await tx.insert(tagLabels).values(created.flatMap((tag) => [
              { tagId: tag.id, language: "en", name: tag.slug },
              { tagId: tag.id, language: "pt-BR", name: tag.slug },
            ])).onConflictDoNothing();
          }
          const selected = await tx.select({ id: tags.id }).from(tags).where(and(
            eq(tags.workspaceId, workspaceId),
            inArray(tags.slug, requestedSlugs),
          ));
          await tx.insert(resourceTags).values(selected.map((tag) => ({
            resourceId: id,
            tagId: tag.id,
            source: "user",
          }))).onConflictDoNothing();
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
    const links = await this.db.select({
      resourceId: resourceTags.resourceId,
      tagId: tags.id,
      slug: tags.slug,
      source: resourceTags.source,
    }).from(resourceTags).innerJoin(tags, eq(tags.id, resourceTags.tagId))
      .where(inArray(resourceTags.resourceId, ids));
    const tagIds = [...new Set(links.map((link) => link.tagId))];
    const [labels, aliases] = tagIds.length
      ? await Promise.all([
        this.db.select().from(tagLabels).where(inArray(tagLabels.tagId, tagIds)),
        this.db.select().from(tagAliases).where(inArray(tagAliases.tagId, tagIds)),
      ])
      : [[], []];
    return rows.map((row) =>
      mapResource(
        row,
        this.publicSiteOrigin,
        links.filter((link) => link.resourceId === row.id).map(
          (link) => ({
            slug: link.slug,
            labels: labels.filter((label) => label.tagId === link.tagId).map((label) => ({
              language: label.language as "en" | "pt-BR",
              name: label.name,
            })),
            aliases: aliases.filter((alias) => alias.tagId === link.tagId).map((alias) =>
              alias.aliasNormalized
            ),
            source: link.source as "ai" | "user",
          }),
        ),
      )
    );
  }
}

function like(column: SQLWrapper, pattern: string) {
  return sql<boolean>`${column} ilike ${pattern} escape '\\'`;
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
    outputLanguage: row.outputLanguage as "pt-BR" | "en",
    enrichmentStatus: row.enrichmentStatus as "preparing" | "ready" | "failed",
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
