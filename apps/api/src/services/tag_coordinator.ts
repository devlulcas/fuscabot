import type { TransactionalQuery } from "../repositories/discord_setup_repository.ts";

export type TagRecord = {
  id: string;
  slug: string;
  labels: Array<{ language: "en" | "pt-BR"; name: string }>;
  aliases: string[];
};

type TagRow = { id: string; slug: string; labels: TagRecord["labels"]; aliases: string[] };

export class PostgresTagCoordinator {
  constructor(
    private readonly ownerId: string,
    private readonly workspaceId: string,
    private readonly db: TransactionalQuery,
  ) {}

  async list(ownerId: string, search?: string): Promise<TagRecord[]> {
    this.owner(ownerId);
    const result = await this.db.queryObject<TagRow>(
      `${SELECT_TAGS}
      WHERE t.workspace_id=$1::uuid AND ($2::text IS NULL OR t.slug ILIKE '%'||$2||'%' OR EXISTS (SELECT 1 FROM tag_labels sl WHERE sl.tag_id=t.id AND sl.name ILIKE '%'||$2||'%') OR EXISTS (SELECT 1 FROM tag_aliases sa WHERE sa.tag_id=t.id AND sa.alias_normalized ILIKE '%'||$2||'%')) ORDER BY t.slug`,
      [this.workspaceId, search ?? null],
    );
    return result.rows;
  }

  async create(
    ownerId: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<TagRecord> {
    this.owner(ownerId);
    return await this.db.transaction(async (sql) => {
      const tag = (await sql.queryObject<{ id: string }>(
        `INSERT INTO tags(workspace_id,slug) VALUES($1::uuid,$2) RETURNING id`,
        [this.workspaceId, normalize(input.slug)],
      )).rows[0];
      await sql.queryObject(
        `INSERT INTO tag_labels(tag_id,language,name) VALUES($1::uuid,'en',$2),($1::uuid,'pt-BR',$3)`,
        [tag.id, input.english.trim(), input.portuguese.trim()],
      );
      for (const alias of new Set(input.aliases.map(normalize).filter(Boolean))) {
        await sql.queryObject(
          `INSERT INTO tag_aliases(workspace_id,tag_id,alias_normalized) VALUES($1::uuid,$2::uuid,$3) ON CONFLICT DO NOTHING`,
          [this.workspaceId, tag.id, alias],
        );
      }
      return (await this.list(ownerId)).find((row) => row.id === tag.id)!;
    });
  }

  async merge(ownerId: string, sourceId: string, targetId: string): Promise<TagRecord> {
    this.owner(ownerId);
    if (sourceId === targetId) throw new Error("Choose two different tags");
    await this.db.transaction(async (sql) => {
      await sql.queryObject(
        `INSERT INTO resource_tags(resource_id,tag_id,source) SELECT resource_id,$3::uuid,source FROM resource_tags rt JOIN tags s ON s.id=rt.tag_id JOIN tags t ON t.id=$3::uuid WHERE s.id=$2::uuid AND s.workspace_id=$1::uuid AND t.workspace_id=$1::uuid ON CONFLICT DO NOTHING`,
        [this.workspaceId, sourceId, targetId],
      );
      await sql.queryObject(`DELETE FROM tags WHERE workspace_id=$1::uuid AND id=$2::uuid`, [
        this.workspaceId,
        sourceId,
      ]);
    });
    const target = (await this.list(ownerId)).find((tag) => tag.id === targetId);
    if (!target) throw new Error("Tag not found");
    return target;
  }

  async update(
    ownerId: string,
    id: string,
    input: { slug: string; english: string; portuguese: string; aliases: string[] },
  ): Promise<TagRecord> {
    this.owner(ownerId);
    await this.db.transaction(async (sql) => {
      await sql.queryObject(
        `UPDATE tags SET slug=$3,updated_at=now() WHERE workspace_id=$1::uuid AND id=$2::uuid`,
        [
          this.workspaceId,
          id,
          normalize(input.slug),
        ],
      );
      await sql.queryObject(
        `INSERT INTO tag_labels(tag_id,language,name) VALUES($1::uuid,'en',$2),($1::uuid,'pt-BR',$3) ON CONFLICT(tag_id,language) DO UPDATE SET name=excluded.name`,
        [id, input.english.trim(), input.portuguese.trim()],
      );
      await sql.queryObject(
        `DELETE FROM tag_aliases WHERE workspace_id=$1::uuid AND tag_id=$2::uuid`,
        [
          this.workspaceId,
          id,
        ],
      );
      for (const alias of new Set(input.aliases.map(normalize).filter(Boolean))) {
        await sql.queryObject(
          `INSERT INTO tag_aliases(workspace_id,tag_id,alias_normalized) VALUES($1::uuid,$2::uuid,$3)`,
          [this.workspaceId, id, alias],
        );
      }
    });
    const updated = (await this.list(ownerId)).find((tag) => tag.id === id);
    if (!updated) throw new Error("Tag not found");
    return updated;
  }

  private owner(ownerId: string): void {
    if (ownerId !== this.ownerId) throw new Error("Workspace access denied");
  }
}

const SELECT_TAGS = `SELECT t.id,t.slug,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('language',l.language,'name',l.name) ORDER BY l.language) FROM tag_labels l WHERE l.tag_id=t.id),'[]'::jsonb) labels,
  COALESCE((SELECT jsonb_agg(a.alias_normalized ORDER BY a.alias_normalized) FROM tag_aliases a WHERE a.tag_id=t.id),'[]'::jsonb) aliases
  FROM tags t`;

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
