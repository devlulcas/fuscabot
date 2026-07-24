import { render, startViewTransition, useEffect, useState } from "@hono/hono/jsx/dom";
import { type ArchiveDateLocale, calendarDateKey, formatArchiveDate } from "./dates.ts";

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

function localizeDates(root: ParentNode = document): void {
  const locale: ArchiveDateLocale = document.documentElement.lang.toLowerCase() === "pt-br"
    ? "pt-br"
    : "en";
  for (const time of root.querySelectorAll<HTMLTimeElement>("time[data-local-date]")) {
    if (!validDateTime(time.dateTime)) continue;
    time.textContent = formatArchiveDate(time.dateTime, locale);
  }
  for (const pair of root.querySelectorAll<HTMLElement>("[data-local-date-pair]")) {
    updateDatePair(pair);
  }
}

function updateDatePair(pair: HTMLElement): void {
  const published = pair.querySelector<HTMLTimeElement>(
    'time[data-local-date-role="published"]',
  );
  const updated = pair.querySelector<HTMLTimeElement>(
    'time[data-local-date-role="updated"]',
  );
  const updatedRow = pair.querySelector<HTMLElement>("[data-updated-date]");
  if (
    !published || !updated || !updatedRow ||
    !validDateTime(published.dateTime) || !validDateTime(updated.dateTime)
  ) return;
  updatedRow.hidden = calendarDateKey(published.dateTime) === calendarDateKey(updated.dateTime);
}

function validDateTime(value: string): boolean {
  return value !== "" && Number.isFinite(Date.parse(value));
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

localizeDates();
