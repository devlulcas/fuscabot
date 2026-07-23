import { render, startViewTransition, useEffect, useState } from "@hono/hono/jsx/dom";

type Theme = "light" | "dark";

const STORAGE_KEY = "fuscabot-theme";
const themes: readonly Theme[] = ["light", "dark"];

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#20231f" : "#f4f0e5",
  );
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme selection remains useful for the current page when storage is unavailable.
  }
}

function ThemeControl(
  { label, labels }: { label: string; labels: Record<Theme, string> },
) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const selectTheme = (next: Theme) => {
    if (next === theme) return;
    startViewTransition(() => {
      storeTheme(next);
      applyTheme(next);
      setTheme(next);
    });
  };

  return (
    <div class="theme-control" role="group" aria-label={label}>
      {themes.map((value) => (
        <button
          key={value}
          class="theme-choice"
          type="button"
          aria-label={labels[value]}
          aria-pressed={theme === value ? "true" : "false"}
          title={labels[value]}
          onClick={() => selectTheme(value)}
        >
          <span aria-hidden="true">{themeIcon(value)}</span>
        </button>
      ))}
    </div>
  );
}

function themeIcon(theme: Theme): string {
  if (theme === "light") return "☀";
  return "☾";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

const mount = document.querySelector<HTMLElement>("[data-theme-control]");
if (mount) {
  render(
    <ThemeControl
      label={mount.dataset.label ?? "Theme"}
      labels={{
        light: mount.dataset.light ?? "Use light theme",
        dark: mount.dataset.dark ?? "Use dark theme",
      }}
    />,
    mount,
  );
}
