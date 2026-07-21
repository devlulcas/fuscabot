import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { resourceTags, tagAliases, tagLabels, tags } from "../db/schema.ts";

export type TagRecord = {
  id: string;
  slug: string;
  labels: Array<{ language: "en" | "pt-BR"; name: string }>;
  aliases: string[];
};

export class TagNotFoundError extends Error {}

export class PostgresTagCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly workspaceId: string,
    private readonly db: AppDatabase,
  ) {}

  async list(ownerId: string, search?: string): Promise<TagRecord[]> {
    this.owner(ownerId);
    const term = search?.trim();
    const matchingIds = term
      ? await this.db.selectDistinct({ id: tags.id }).from(tags)
        .leftJoin(tagLabels, eq(tagLabels.tagId, tags.id))
        .leftJoin(tagAliases, eq(tagAliases.tagId, tags.id))
        .where(and(
          eq(tags.workspaceId, this.workspaceId),
          or(
            ilike(tags.slug, `%${escapeLike(term)}%`),
            ilike(tagLabels.name, `%${escapeLike(term)}%`),
            ilike(tagAliases.aliasNormalized, `%${escapeLike(term)}%`),
          ),
        ))
      : null;
    if (matchingIds && matchingIds.length === 0) return [];
    const rows = await this.db.select({ id: tags.id, slug: tags.slug }).from(tags).where(and(
      eq(tags.workspaceId, this.workspaceId),
      matchingIds ? inArray(tags.id, matchingIds.map((row) => row.id)) : undefined,
    )).orderBy(asc(tags.slug));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [labels, aliases] = await Promise.all([
      this.db.select().from(tagLabels).where(inArray(tagLabels.tagId, ids)),
      this.db.select().from(tagAliases).where(and(
        eq(tagAliases.workspaceId, this.workspaceId),
        inArray(tagAliases.tagId, ids),
      )),
    ]);
    return rows.map((row) => ({
      ...row,
      labels: labels.filter((label) => label.tagId === row.id).map((label) => ({
        language: label.language as "en" | "pt-BR",
        name: label.name,
      })),
      aliases: aliases.filter((alias) => alias.tagId === row.id).map((alias) =>
        alias.aliasNormalized
      ).sort(),
    }));
  }

  async create(ownerId: string, input: TagInput): Promise<TagRecord> {
    this.owner(ownerId);
    const id = await this.db.transaction(async (tx) => {
      const [tag] = await tx.insert(tags).values({
        workspaceId: this.workspaceId,
        slug: normalize(input.slug),
      }).returning({ id: tags.id });
      if (!tag) throw new Error("Tag creation returned no row");
      await tx.insert(tagLabels).values(labelValues(tag.id, input));
      const aliases = aliasValues(this.workspaceId, tag.id, input.aliases);
      if (aliases.length) await tx.insert(tagAliases).values(aliases).onConflictDoNothing();
      return tag.id;
    });
    return await this.require(ownerId, id);
  }

  async merge(ownerId: string, sourceId: string, targetId: string): Promise<TagRecord> {
    this.owner(ownerId);
    if (sourceId === targetId) throw new Error("Choose two different tags");
    await this.db.transaction(async (tx) => {
      const owned = await tx.select({ id: tags.id }).from(tags).where(and(
        eq(tags.workspaceId, this.workspaceId),
        inArray(tags.id, [sourceId, targetId]),
      ));
      if (owned.length !== 2) throw new TagNotFoundError("Tag not found");
      const links = await tx.select().from(resourceTags).where(eq(resourceTags.tagId, sourceId));
      if (links.length) {
        await tx.insert(resourceTags).values(links.map((link) => ({
          resourceId: link.resourceId,
          tagId: targetId,
          source: link.source,
        }))).onConflictDoNothing();
      }
      await tx.delete(tags).where(
        and(eq(tags.workspaceId, this.workspaceId), eq(tags.id, sourceId)),
      );
    });
    return await this.require(ownerId, targetId);
  }

  async update(ownerId: string, id: string, input: TagInput): Promise<TagRecord> {
    this.owner(ownerId);
    await this.db.transaction(async (tx) => {
      const owned = await tx.update(tags).set({
        slug: normalize(input.slug),
        updatedAt: new Date(),
      })
        .where(and(eq(tags.workspaceId, this.workspaceId), eq(tags.id, id)))
        .returning({ id: tags.id });
      if (!owned[0]) throw new TagNotFoundError("Tag not found");
      for (const label of labelValues(id, input)) {
        await tx.insert(tagLabels).values(label).onConflictDoUpdate({
          target: [tagLabels.tagId, tagLabels.language],
          set: { name: label.name },
        });
      }
      await tx.delete(tagAliases).where(and(
        eq(tagAliases.workspaceId, this.workspaceId),
        eq(tagAliases.tagId, id),
      ));
      const aliases = aliasValues(this.workspaceId, id, input.aliases);
      if (aliases.length) await tx.insert(tagAliases).values(aliases);
    });
    return await this.require(ownerId, id);
  }

  private async require(ownerId: string, id: string): Promise<TagRecord> {
    const tag = (await this.list(ownerId)).find((candidate) => candidate.id === id);
    if (!tag) throw new TagNotFoundError("Tag not found");
    return tag;
  }

  private owner(ownerId: string): void {
    if (ownerId !== this.ownerId) throw new Error("Workspace access denied");
  }
}

type TagInput = { slug: string; english: string; portuguese: string; aliases: string[] };

function labelValues(tagId: string, input: TagInput) {
  return [
    { tagId, language: "en", name: input.english.trim() },
    { tagId, language: "pt-BR", name: input.portuguese.trim() },
  ];
}

function aliasValues(workspaceId: string, tagId: string, aliases: string[]) {
  return [...new Set(aliases.map(normalize).filter(Boolean))].map((aliasNormalized) => ({
    workspaceId,
    tagId,
    aliasNormalized,
  }));
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
