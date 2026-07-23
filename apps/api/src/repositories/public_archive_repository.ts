import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { resources, resourceTags, tagLabels, tags } from "../db/schema.ts";

type StoredPublicArchiveTag = {
  slug: string;
  english: string;
  portuguese: string;
};

export type PublicArchiveItem = {
  slug: string;
  title: string;
  summary: string | null;
  selectedText: string | null;
  sourceDomain: string;
  outboundUrl: string;
  tags: Array<{ slug: string; label: string }>;
  publishedAt: Date;
  updatedAt: Date;
};

export type PublicArchiveListInput = {
  locale: "en" | "pt-br";
  query?: string;
  tag?: string;
  page: number;
  pageSize: number;
};

export interface PublicArchiveReader {
  list(input: PublicArchiveListInput): Promise<{
    items: PublicArchiveItem[];
    total: number;
    tags: Array<{ slug: string; label: string }>;
  }>;
  getBySlug(slug: string, locale: "en" | "pt-br"): Promise<PublicArchiveItem | null>;
  listForSitemap(): Promise<Array<{ slug: string; updatedAt: Date }>>;
}

export class PostgresPublicArchiveRepository implements PublicArchiveReader {
  constructor(
    private readonly db: AppDatabase,
    private readonly workspaceId: string,
  ) {}

  async list(
    input: PublicArchiveListInput,
  ): Promise<{
    items: PublicArchiveItem[];
    total: number;
    tags: Array<{ slug: string; label: string }>;
  }> {
    const term = input.query?.trim().slice(0, 100);
    const predicates = this.predicates(term, input.tag);
    const page = Math.max(1, Math.trunc(input.page));
    const pageSize = 20;
    const tagRank = term
      ? sql<number>`case when exists (
          select 1 from ${resourceTags} rank_rt
          join ${tags} rank_t on rank_t.id = rank_rt.tag_id
          join ${tagLabels} rank_tl on rank_tl.tag_id = rank_t.id
          where rank_rt.resource_id = ${resources.id}
            and (rank_t.slug ilike ${`%${escapeLike(term)}%`} escape '\\'
              or rank_tl.name ilike ${`%${escapeLike(term)}%`} escape '\\')
        ) then 1 else 0 end`
      : sql<number>`0`;
    const [rows, counts, availableTags] = await Promise.all([
      this.db.select().from(resources).where(and(...predicates)).orderBy(
        desc(tagRank),
        term
          ? desc(sql<number>`ts_rank(${sql.identifier("public_search_document")},
              websearch_to_tsquery('simple', ${term}))`)
          : desc(resources.publicPublishedAt),
        desc(resources.publicPublishedAt),
        desc(resources.id),
      ).limit(pageSize).offset((page - 1) * pageSize),
      this.db.select({ count: sql<number>`count(*)::int` }).from(resources)
        .where(and(...predicates)),
      this.loadTags(),
    ]);
    return {
      items: await this.hydrate(rows, input.locale),
      total: counts[0]?.count ?? 0,
      tags: localizeTags(availableTags, input.locale),
    };
  }

  async getBySlug(
    slug: string,
    locale: "en" | "pt-br",
  ): Promise<PublicArchiveItem | null> {
    const rows = await this.db.select().from(resources).where(and(
      eq(resources.workspaceId, this.workspaceId),
      eq(resources.publicSlug, slug),
      isNotNull(resources.publicPublishedAt),
    )).limit(1);
    return (await this.hydrate(rows, locale))[0] ?? null;
  }

  private async loadTags(): Promise<StoredPublicArchiveTag[]> {
    const rows = await this.db.select({
      slug: tags.slug,
      language: tagLabels.language,
      name: tagLabels.name,
    }).from(tags).innerJoin(resourceTags, eq(resourceTags.tagId, tags.id))
      .innerJoin(resources, eq(resources.id, resourceTags.resourceId))
      .innerJoin(tagLabels, eq(tagLabels.tagId, tags.id))
      .where(and(
        eq(resources.workspaceId, this.workspaceId),
        isNotNull(resources.publicPublishedAt),
      ))
      .orderBy(tags.slug);
    return mapTags(rows);
  }

  async listForSitemap(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    const rows = await this.db.select({
      slug: resources.publicSlug,
      updatedAt: resources.updatedAt,
    }).from(resources).where(and(
      eq(resources.workspaceId, this.workspaceId),
      isNotNull(resources.publicPublishedAt),
    ))
      .orderBy(desc(resources.publicPublishedAt));
    return rows.flatMap((row) => row.slug ? [{ slug: row.slug, updatedAt: row.updatedAt }] : []);
  }

  private predicates(query?: string, tag?: string) {
    const predicates = [
      eq(resources.workspaceId, this.workspaceId),
      isNotNull(resources.publicPublishedAt),
    ];
    const term = query?.trim();
    if (term) {
      const pattern = `%${escapeLike(term)}%`;
      predicates.push(sql<boolean>`(
        ${sql.identifier("public_search_document")}
          @@ websearch_to_tsquery('simple', ${term})
        or exists (
          select 1 from ${resourceTags} search_rt
          join ${tags} search_t on search_t.id = search_rt.tag_id
          join ${tagLabels} search_tl on search_tl.tag_id = search_t.id
          where search_rt.resource_id = ${resources.id}
            and (search_t.slug ilike ${pattern} escape '\\'
              or search_tl.name ilike ${pattern} escape '\\')
        )
      )`);
    }
    if (tag) {
      predicates.push(sql<boolean>`exists (
        select 1 from ${resourceTags} filter_rt
        join ${tags} filter_t on filter_t.id = filter_rt.tag_id
        where filter_rt.resource_id = ${resources.id}
          and filter_t.slug = ${tag}
      )`);
    }
    return predicates;
  }

  private async hydrate(
    rows: Array<typeof resources.$inferSelect>,
    locale: "en" | "pt-br",
  ): Promise<PublicArchiveItem[]> {
    const ids = rows.map((row) => row.id);
    const tagRows = ids.length
      ? await this.db.select({
        resourceId: resourceTags.resourceId,
        slug: tags.slug,
        language: tagLabels.language,
        name: tagLabels.name,
      }).from(resourceTags).innerJoin(tags, eq(tags.id, resourceTags.tagId))
        .innerJoin(tagLabels, eq(tagLabels.tagId, tags.id))
        .where(inArray(resourceTags.resourceId, ids))
      : [];
    return rows.flatMap((row) => {
      if (!row.publicSlug || !row.publicPublishedAt) return [];
      const outboundUrl = safeOutboundUrl(row.canonicalUrl ?? row.normalizedUrl);
      if (!outboundUrl) return [];
      return [{
        slug: row.publicSlug,
        title: row.title,
        summary: row.summary,
        selectedText: row.selectedQuote,
        sourceDomain: row.sourceDomain,
        outboundUrl,
        tags: localizeTags(
          mapTags(tagRows.filter((tag) => tag.resourceId === row.id)),
          locale,
        ),
        publishedAt: row.publicPublishedAt,
        updatedAt: row.updatedAt,
      }];
    });
  }
}

function mapTags(
  rows: Array<{ slug: string; language: string; name: string }>,
): StoredPublicArchiveTag[] {
  return [...new Set(rows.map((row) => row.slug))].map((slug) => {
    const labels = rows.filter((row) => row.slug === slug);
    return {
      slug,
      english: labels.find((label) => label.language === "en")?.name ?? slug,
      portuguese: labels.find((label) => label.language === "pt-BR")?.name ?? slug,
    };
  });
}

function localizeTags(
  tags: StoredPublicArchiveTag[],
  locale: "en" | "pt-br",
): Array<{ slug: string; label: string }> {
  return tags.map((tag) => ({
    slug: tag.slug,
    label: locale === "pt-br" ? tag.portuguese : tag.english,
  }));
}

function safeOutboundUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
