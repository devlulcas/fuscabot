import { expect, it } from "vitest";
import { normalizeAccentColor, normalizeTheme } from "./config.ts";
import { capturePath, cleanOptionalText } from "./types.ts";

it("cleans optional capture text", () => {
  expect(cleanOptionalText("  hello\n world ")).toBe("hello world");
  expect(cleanOptionalText("   ")).toBeNull();
});
it("encodes capture routes", () =>
  expect(capturePath("a/b")).toBe("/capture/a%2Fb"));
it("normalizes appearance preferences", () => {
  expect(normalizeTheme("adwaita")).toBe("botanical");
  expect(normalizeTheme("adwaita-dark")).toBe("botanical-dark");
  expect(normalizeTheme("system")).toBe("system");
  expect(normalizeTheme("unknown")).toBe("botanical");
  expect(normalizeAccentColor("#35A4E8")).toBe("#35a4e8");
  expect(normalizeAccentColor("blue")).toBeUndefined();
});
