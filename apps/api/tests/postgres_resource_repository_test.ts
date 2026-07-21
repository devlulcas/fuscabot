import { assertEquals, assertStringIncludes } from "@std/assert";

const source = await Deno.readTextFile(
  new URL("../src/repositories/postgres_resource_repository.ts", import.meta.url),
);

Deno.test("resource repository is Drizzle-first and keeps workspace predicates", () => {
  assertEquals(source.includes(".query("), false);
  assertEquals(source.includes("queryObject"), false);
  assertEquals(source.includes("sql.raw"), false);
  assertStringIncludes(source, "eq(resources.workspaceId, workspaceId)");
  assertStringIncludes(source, '.for("update")');
  assertStringIncludes(source, "tx.delete(resourceTags)");
});

Deno.test("resource search binds hostile values and includes bilingual tag metadata", () => {
  assertStringIncludes(source, "escapeLike(term)");
  assertStringIncludes(source, "websearch_to_tsquery");
  assertStringIncludes(source, "${pattern}");
  assertStringIncludes(source, "tagLabels");
  assertStringIncludes(source, "tagAliases");
  assertEquals(source.includes("sql.raw"), false);
});
