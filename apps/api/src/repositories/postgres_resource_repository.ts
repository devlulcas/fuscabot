import type { Resource, ResourcePatch } from "../domain/resource.ts";
import type { BulkResourceAction } from "@fuscabot/contracts";
import type { DatabasePool } from "../db/client.ts";
import type { ResourceQuery, ResourceRepository } from "./resource_repository.ts";

type ResourceRow = {
  id: string;
  workspace_id: string;
  original_url: string;
  normalized_url: string;
  canonical_url: string | null;
  canonical_url_key: string;
  source_domain: string;
  source_language: string;
  output_language: "pt-BR" | "en";
  title: string;
  description: string | null;
  site_name: string | null;
  author: string | null;
  published_at_source: Date | string | null;
  image_url: string | null;
  selected_quote: string | null;
  summary: string | null;
  why_useful: string | null;
  personal_note: string | null;
  enrichment_status: "preparing" | "ready" | "failed";
  enrichment_error: string | null;
  archived_at: Date | string | null;
  tags: Resource["tags"] | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const selectResource = `SELECT r.*,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'slug', t.slug,
      'labels', COALESCE((SELECT jsonb_agg(jsonb_build_object('language', tl.language, 'name', tl.name) ORDER BY tl.language) FROM tag_labels tl WHERE tl.tag_id = t.id), '[]'::jsonb),
      'aliases', COALESCE((SELECT jsonb_agg(ta.alias_normalized ORDER BY ta.alias_normalized) FROM tag_aliases ta WHERE ta.tag_id = t.id), '[]'::jsonb),
      'source', rt.source
    ) ORDER BY t.slug)
    FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id
  ), '[]'::jsonb) AS tags
FROM resources r`;

export class PostgresResourceRepository implements ResourceRepository {
  constructor(private database: DatabasePool) {}

  async findById(workspaceId: string, id: string): Promise<Resource | null> {
    const result = await this.database.query<ResourceRow>(
      `${selectResource} WHERE r.workspace_id = $1 AND r.id = $2`,
      [workspaceId, id],
    );
    return result.rows[0] ? mapResource(result.rows[0]) : null;
  }

  async findByCanonicalKey(workspaceId: string, key: string): Promise<Resource | null> {
    const result = await this.database.query<ResourceRow>(
      `${selectResource} WHERE r.workspace_id = $1 AND r.canonical_url_key = $2`,
      [workspaceId, key],
    );
    return result.rows[0] ? mapResource(result.rows[0]) : null;
  }

  async create(resource: Resource): Promise<Resource> {
    await this.database.query(
      `INSERT INTO resources (
        id, workspace_id, original_url, normalized_url, canonical_url, canonical_url_key,
        source_domain, source_language, output_language, title, description, site_name, author,
        published_at_source, image_url, selected_quote, summary, why_useful, personal_note,
        enrichment_status, enrichment_error, archived_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      ) ON CONFLICT (workspace_id, canonical_url_key)
        DO UPDATE SET updated_at = resources.updated_at`,
      [
        resource.id,
        resource.workspaceId,
        resource.originalUrl,
        resource.normalizedUrl,
        resource.canonicalUrl,
        resource.canonicalUrlKey,
        resource.sourceDomain,
        resource.sourceLanguage,
        resource.outputLanguage,
        resource.title,
        resource.description,
        resource.siteName,
        resource.author,
        resource.publishedAtSource,
        resource.imageUrl,
        resource.selectedQuote,
        resource.summary,
        resource.whyUseful,
        resource.personalNote,
        resource.enrichmentStatus,
        resource.enrichmentError,
        resource.archivedAt,
        resource.createdAt,
        resource.updatedAt,
      ],
    );
    const persisted = await this.findByCanonicalKey(resource.workspaceId, resource.canonicalUrlKey);
    if (!persisted) throw new Error("Created resource could not be loaded");
    return persisted;
  }

  async list(workspaceId: string, query: ResourceQuery): Promise<Resource[]> {
    const values: unknown[] = [workspaceId];
    const predicates = ["r.workspace_id = $1"];
    if (query.archived !== undefined) {
      values.push(query.archived);
      predicates.push(`(r.archived_at IS NOT NULL) = $${values.length}`);
    }
    if (query.domain) {
      values.push(query.domain);
      predicates.push(`r.source_domain = $${values.length}`);
    }
    if (query.enrichmentStatus) {
      values.push(query.enrichmentStatus);
      predicates.push(`r.enrichment_status = $${values.length}`);
    }
    if (query.tag) {
      values.push(query.tag);
      const parameter = `$${values.length}`;
      predicates.push(
        `EXISTS (SELECT 1 FROM resource_tags frt JOIN tags ft ON ft.id=frt.tag_id LEFT JOIN tag_labels ftl ON ftl.tag_id=ft.id LEFT JOIN tag_aliases fta ON fta.tag_id=ft.id WHERE frt.resource_id=r.id AND (ft.slug=${parameter} OR ftl.name=${parameter} OR fta.alias_normalized=${parameter}))`,
      );
    }
    if (query.state === "archived") predicates.push("r.archived_at IS NOT NULL");
    if (query.state === "inbox") {
      predicates.push(
        "r.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM deliveries sd WHERE sd.resource_id=r.id AND sd.status='sent')",
      );
    }
    if (query.state === "shared" || query.state === "read_later") {
      values.push(query.state === "shared" ? "share" : "read_later");
      predicates.push(
        `EXISTS (SELECT 1 FROM deliveries sd WHERE sd.resource_id=r.id AND sd.status='sent' AND sd.delivery_kind=$${values.length})`,
      );
    }
    if (query.search?.trim()) {
      values.push(query.search.trim(), `%${escapeLike(query.search.trim())}%`);
      const fullText = `$${values.length - 1}`;
      const parameter = `$${values.length}`;
      predicates.push(`(
        r.search_document @@ websearch_to_tsquery('simple', ${fullText}) OR
        r.title ILIKE ${parameter} ESCAPE '\\' OR r.original_url ILIKE ${parameter} ESCAPE '\\' OR
        r.source_domain ILIKE ${parameter} ESCAPE '\\' OR r.summary ILIKE ${parameter} ESCAPE '\\' OR
        r.why_useful ILIKE ${parameter} ESCAPE '\\' OR r.personal_note ILIKE ${parameter} ESCAPE '\\' OR
        r.selected_quote ILIKE ${parameter} ESCAPE '\\' OR EXISTS (
          SELECT 1 FROM resource_tags srt JOIN tags st ON st.id = srt.tag_id
          LEFT JOIN tag_labels stl ON stl.tag_id = st.id LEFT JOIN tag_aliases sta ON sta.tag_id = st.id
          WHERE srt.resource_id = r.id AND (st.slug ILIKE ${parameter} ESCAPE '\\' OR stl.name ILIKE ${parameter} ESCAPE '\\' OR sta.alias_normalized ILIKE ${parameter} ESCAPE '\\')
        )
      )`);
    }
    values.push(query.limit, query.offset);
    const result = await this.database.query<ResourceRow>(
      `${selectResource} WHERE ${predicates.join(" AND ")} ORDER BY ${sortSql(query.sort)} LIMIT $${
        values.length - 1
      } OFFSET $${values.length}`,
      values,
    );
    return result.rows.map(mapResource);
  }

  async update(workspaceId: string, id: string, patch: ResourcePatch): Promise<Resource | null> {
    const assignments: string[] = [];
    const values: unknown[] = [workspaceId, id];
    const set = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };
    if (patch.title !== undefined) set("title", patch.title);
    if (patch.summary !== undefined) set("summary", patch.summary);
    if (patch.whyUseful !== undefined) set("why_useful", patch.whyUseful);
    if (patch.personalNote !== undefined) set("personal_note", patch.personalNote);
    if (patch.selectedQuote !== undefined) set("selected_quote", patch.selectedQuote);
    if (patch.outputLanguage !== undefined) set("output_language", patch.outputLanguage);
    if (patch.archived !== undefined) set("archived_at", patch.archived ? new Date() : null);
    let exists = true;
    if (assignments.length) {
      assignments.push("updated_at = now()");
      const result = await this.database.query(
        `UPDATE resources SET ${assignments.join(", ")} WHERE workspace_id = $1 AND id = $2`,
        values,
      );
      exists = Boolean(result.rowCount);
    } else {
      exists = Boolean(await this.findById(workspaceId, id));
    }
    if (!exists) return null;
    if (patch.tagSlugs) {
      await this.database.query("DELETE FROM resource_tags WHERE resource_id=$1::uuid", [id]);
      await this.database.query(
        `INSERT INTO resource_tags(resource_id,tag_id,source) SELECT $1::uuid,id,'user' FROM tags WHERE workspace_id=$2::uuid AND slug=ANY($3::text[]) ON CONFLICT DO NOTHING`,
        [id, workspaceId, patch.tagSlugs],
      );
    }
    return this.findById(workspaceId, id);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      "DELETE FROM resources WHERE workspace_id = $1 AND id = $2",
      [workspaceId, id],
    );
    return Boolean(result.rowCount);
  }

  async bulkAction(
    workspaceId: string,
    ids: string[],
    action: BulkResourceAction["action"],
  ): Promise<string[] | null> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const owned = await client.query<{ id: string }>(
        "SELECT id FROM resources WHERE workspace_id = $1 AND id = ANY($2::uuid[]) FOR UPDATE",
        [workspaceId, ids],
      );
      if (owned.rows.length !== ids.length) {
        await client.query("ROLLBACK");
        return null;
      }
      if (action === "delete") {
        await client.query(
          "DELETE FROM resources WHERE workspace_id = $1 AND id = ANY($2::uuid[])",
          [workspaceId, ids],
        );
      } else {
        await client.query(
          `UPDATE resources SET archived_at = ${
            action === "archive" ? "now()" : "NULL"
          }, updated_at = now() WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
          [workspaceId, ids],
        );
      }
      await client.query("COMMIT");
      return [...ids];
    } catch (cause) {
      await client.query("ROLLBACK");
      throw cause;
    } finally {
      client.release();
    }
  }
}

function sortSql(sort: ResourceQuery["sort"]): string {
  if (sort === "oldest") return "r.created_at ASC";
  if (sort === "updated") return "r.updated_at DESC";
  return "r.created_at DESC";
}

function mapResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    originalUrl: row.original_url,
    normalizedUrl: row.normalized_url,
    canonicalUrl: row.canonical_url,
    canonicalUrlKey: row.canonical_url_key,
    sourceDomain: row.source_domain,
    sourceLanguage: row.source_language,
    outputLanguage: row.output_language,
    title: row.title,
    description: row.description,
    siteName: row.site_name,
    author: row.author,
    publishedAtSource: iso(row.published_at_source),
    imageUrl: row.image_url,
    selectedQuote: row.selected_quote,
    summary: row.summary,
    whyUseful: row.why_useful,
    personalNote: row.personal_note,
    enrichmentStatus: row.enrichment_status,
    enrichmentError: row.enrichment_error,
    archivedAt: iso(row.archived_at),
    tags: row.tags ?? [],
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
