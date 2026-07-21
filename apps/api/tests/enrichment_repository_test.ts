import { assertEquals, assertStringIncludes } from "@std/assert";

const source = await Deno.readTextFile(
  new URL("../src/repositories/enrichment_repository.ts", import.meta.url),
);

Deno.test("enrichment repository uses Drizzle transactions for claims and completion", () => {
  assertEquals(source.includes(".query("), false);
  assertEquals(source.includes("queryObject"), false);
  assertEquals(source.includes("sql.raw"), false);
  assertStringIncludes(source, '.for("update")');
  assertStringIncludes(source, ".onConflictDoNothing()");
  assertStringIncludes(source, 'eq(enrichmentRuns.status, "preparing")');
  assertStringIncludes(source, 'enrichmentStatus: "ready"');
  assertStringIncludes(source, 'enrichmentStatus: "failed"');
});

Deno.test("enrichment duration is the only fixed PostgreSQL expression", () => {
  const expressions = source.match(/sql<\s*number\s*>`/g) ?? [];
  assertEquals(expressions.length, 2);
  assertStringIncludes(source, "extract(epoch");
});
