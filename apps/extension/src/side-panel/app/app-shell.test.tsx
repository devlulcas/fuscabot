import axe from "axe-core";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.tsx";

describe("application shell accessibility", () => {
  it("has no detectable structural accessibility violations", async () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
