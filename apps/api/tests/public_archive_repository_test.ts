import { assertEquals, assertStringIncludes } from "@std/assert";

const source = await Deno.readTextFile(
  new URL("../src/repositories/public_archive_repository.ts", import.meta.url),
);
const migration = await Deno.readTextFile(
  new URL("../migrations/0008_public_archive.sql", import.meta.url),
);

Deno.test("public projection only maps approved resource fields", () => {
  assertStringIncludes(source, "canonicalUrl ?? row.normalizedUrl");
  assertStringIncludes(source, "selectedText: row.selectedQuote");
  assertStringIncludes(source, "eq(resources.workspaceId, this.workspaceId)");
  for (
    const privateField of [
      "row.personalNote",
      "row.description",
      "row.originalUrl",
      "row.imageUrl",
      "tagAliases",
    ]
  ) {
    assertEquals(source.includes(privateField), false);
  }
});

Deno.test("public migration removes archive and creates isolated search/indexes", () => {
  assertStringIncludes(migration, "UPDATE resources");
  assertStringIncludes(migration, "DROP COLUMN IF EXISTS archived_at");
  assertStringIncludes(migration, "public_search_document");
  assertStringIncludes(migration, "resources_public_slug_uidx");
  assertEquals(migration.includes("personal_note"), false);
  assertEquals(migration.includes("original_url"), false);
  assertEquals(migration.includes("description"), false);
});
