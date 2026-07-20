import { assertEquals, assertThrows } from "@std/assert";
import {
  buildTagAliasIndex,
  normalizeTagTerm,
  resolveTag,
  tagSlug,
} from "./tags.ts";

const systemDesign = {
  slug: "system-design",
  english: "System Design",
  portuguese: "Arquitetura de Sistemas",
  aliases: ["systems design", "desenho de sistemas"],
};

Deno.test("tag terms normalize case, accents, punctuation, and whitespace", () => {
  assertEquals(
    normalizeTagTerm("  ARQUITETURA—de   Sistêmas! "),
    "arquitetura de sistemas",
  );
  assertEquals(tagSlug("Ferramentas de Build"), "ferramentas-de-build");
});

Deno.test("bilingual labels and aliases resolve to one canonical tag", () => {
  const index = buildTagAliasIndex([systemDesign]);
  assertEquals(resolveTag("SYSTEM DESIGN", index)?.slug, "system-design");
  assertEquals(
    resolveTag("arquitetura de sistémas", index)?.slug,
    "system-design",
  );
  assertEquals(resolveTag("desenho de sistemas", index)?.slug, "system-design");
});

Deno.test("alias collisions between canonical tags are rejected", () => {
  assertThrows(() =>
    buildTagAliasIndex([
      systemDesign,
      {
        slug: "architecture",
        english: "Architecture",
        portuguese: "Arquitetura",
        aliases: ["systems design"],
      },
    ])
  );
});
