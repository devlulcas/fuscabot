import { assertEquals, assertStringIncludes } from "@std/assert";

const source = await Deno.readTextFile(
  new URL("../src/repositories/public_archive_repository.ts", import.meta.url),
);
const migrations = [];
for await (const entry of Deno.readDir(new URL("../drizzle/", import.meta.url))) {
  if (entry.isFile && entry.name.endsWith(".sql")) migrations.push(entry.name);
}
const migration = await Deno.readTextFile(
  new URL(`../drizzle/${migrations.sort()[0]}`, import.meta.url),
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

Deno.test("Drizzle baseline creates isolated public search and publication indexes", () => {
  assertEquals(migrations.length, 1);
  assertStringIncludes(migration, "public_search_document");
  assertStringIncludes(migration, "resources_public_slug_uidx");
  const publicSearch = migration.slice(
    migration.indexOf('"public_search_document"'),
    migration.indexOf('"created_at"', migration.indexOf('"public_search_document"')),
  );
  assertEquals(publicSearch.includes("personal_note"), false);
  assertEquals(publicSearch.includes("original_url"), false);
  assertEquals(publicSearch.includes("description"), false);
});
