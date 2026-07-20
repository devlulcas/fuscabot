import { assertEquals } from "@std/assert";
import { parseRoute } from "./router.ts";
Deno.test("parses known routes and falls back to library", () => {
  assertEquals(parseRoute("#/capture/abc"), {
    name: "capture",
    captureId: "abc",
  });
  assertEquals(parseRoute("#/settings"), { name: "settings" });
  assertEquals(parseRoute("#/wat"), { name: "library" });
});
