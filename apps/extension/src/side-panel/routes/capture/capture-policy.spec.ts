import { describe, expect, it } from "vitest";
import { canPublish } from "./capture-policy.ts";

describe("capture publishing policy", () => {
  it("waits for the manual AI action to leave preparing state", () => {
    expect(canPublish("preparing")).toBe(false);
    expect(canPublish("ready")).toBe(true);
    expect(canPublish("failed")).toBe(true);
  });
});
