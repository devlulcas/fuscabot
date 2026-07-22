import { assertEquals } from "@std/assert";
import { serializeError } from "../src/observability/log.ts";

Deno.test("structured error logging preserves safe diagnostics and nested causes", () => {
  const cause = Object.assign(new Error("database rejected query"), {
    code: "23505",
    constraint: "enrichment_runs_one_preparing_per_resource_uidx",
  });
  const error = new Error("Could not persist enrichment", { cause });

  const serialized = serializeError(error);

  assertEquals(serialized.type, "Error");
  assertEquals(serialized.message, "Could not persist enrichment");
  assertEquals(serialized.cause, {
    type: "Error",
    message: "database rejected query",
    stack: cause.stack,
    code: "23505",
    constraint: "enrichment_runs_one_preparing_per_resource_uidx",
  });
});

Deno.test("structured error logging does not serialize arbitrary objects", () => {
  assertEquals(serializeError({ apiKey: "must-not-leak" }), {
    type: "UnknownError",
    message: "[object Object]",
  });
});
