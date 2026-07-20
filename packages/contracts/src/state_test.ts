import { assertEquals } from "@std/assert";
import { deriveLibraryState } from "./state.ts";

Deno.test("deriveLibraryState follows delivery precedence", () => {
  assertEquals(deriveLibraryState(null, []), "inbox");
  assertEquals(
    deriveLibraryState(null, [{ deliveryKind: "read_later", status: "sent" }]),
    "read_later",
  );
  assertEquals(
    deriveLibraryState(null, [
      { deliveryKind: "read_later", status: "sent" },
      { deliveryKind: "share", status: "sent" },
    ]),
    "shared",
  );
});

Deno.test("deriveLibraryState ignores incomplete deliveries and prioritizes archive", () => {
  assertEquals(
    deriveLibraryState(null, [
      { deliveryKind: "share", status: "pending" },
      { deliveryKind: "read_later", status: "failed" },
    ]),
    "inbox",
  );
  assertEquals(
    deriveLibraryState("2026-07-20T12:00:00Z", [
      { deliveryKind: "share", status: "sent" },
    ]),
    "archived",
  );
});
