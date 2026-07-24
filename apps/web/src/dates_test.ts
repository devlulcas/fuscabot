import { assertEquals, assertNotEquals } from "@std/assert";
import { calendarDateKey, formatArchiveDate } from "./dates.ts";

Deno.test("archive dates format an instant in the requested timezone and locale", () => {
  const instant = "2026-07-23T00:30:00.000Z";

  assertEquals(formatArchiveDate(instant, "en", "UTC"), "Jul 23, 2026");
  assertEquals(formatArchiveDate(instant, "en", "America/Sao_Paulo"), "Jul 22, 2026");
  assertEquals(formatArchiveDate(instant, "pt-br", "America/Sao_Paulo"), "22 de jul. de 2026");
});

Deno.test("calendar date comparisons follow the requested timezone", () => {
  const published = "2026-07-23T23:30:00.000Z";
  const updated = "2026-07-24T01:00:00.000Z";

  assertNotEquals(calendarDateKey(published, "UTC"), calendarDateKey(updated, "UTC"));
  assertEquals(
    calendarDateKey(published, "America/Sao_Paulo"),
    calendarDateKey(updated, "America/Sao_Paulo"),
  );
});

Deno.test("a UTC date match can cross a local calendar boundary", () => {
  const published = "2026-07-23T00:30:00.000Z";
  const updated = "2026-07-23T23:30:00.000Z";

  assertEquals(calendarDateKey(published, "UTC"), calendarDateKey(updated, "UTC"));
  assertNotEquals(
    calendarDateKey(published, "Asia/Tokyo"),
    calendarDateKey(updated, "Asia/Tokyo"),
  );
});
