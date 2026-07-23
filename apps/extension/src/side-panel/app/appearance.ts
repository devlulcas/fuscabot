import type { ExtensionConfig, UiTheme } from "../../shared/config.ts";

const ACCENTS: Record<UiTheme, string> = {
  system: "#66755b",
  botanical: "#66755b",
  "botanical-dark": "#a8b89b",
};
const colorScheme = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
let appliedConfig: ExtensionConfig | undefined;

colorScheme?.addEventListener("change", () => {
  if (appliedConfig?.theme === "system") applyAppearance(appliedConfig);
});

export function effectiveAccent(config: ExtensionConfig): string {
  return config.accentColor ?? ACCENTS[config.theme];
}

export function applyAppearance(config: ExtensionConfig): void {
  appliedConfig = config;
  const theme = config.theme === "system"
    ? colorScheme?.matches ? "botanical-dark" : "botanical"
    : config.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty(
    "--accent",
    effectiveAccent(config),
  );
}
