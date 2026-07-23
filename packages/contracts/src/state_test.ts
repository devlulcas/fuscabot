import { assertEquals } from "@std/assert";
import { deriveLibraryState } from "./state.ts";

Deno.test("deriveLibraryState follows delivery precedence", () => {
  assertEquals(deriveLibraryState([]), "inbox");
  assertEquals(
    deriveLibraryState([{ deliveryKind: "read_later", status: "sent" }]),
    "read_later",
  );
  assertEquals(
    deriveLibraryState([
      { deliveryKind: "read_later", status: "sent" },
      { deliveryKind: "share", status: "sent" },
    ]),
    "shared",
  );
});

Deno.test("deriveLibraryState ignores incomplete deliveries", () => {
  assertEquals(
    deriveLibraryState([
      { deliveryKind: "share", status: "pending" },
      { deliveryKind: "read_later", status: "failed" },
    ]),
    "inbox",
  );
});
