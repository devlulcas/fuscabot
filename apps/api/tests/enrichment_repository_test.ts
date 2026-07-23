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

Deno.test("enrichment duration uses locked inferred rows instead of raw SQL", () => {
  assertEquals(source.includes("sql<"), false);
  assertEquals(source.includes("extract(epoch"), false);
  assertStringIncludes(source, "elapsedMilliseconds(current.createdAt, now)");
});
