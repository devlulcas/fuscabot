import type { ExtensionConfig, UiTheme } from "../../shared/config.ts";

const ACCENTS: Record<UiTheme, string> = {
  dark: "#9b8cff",
  light: "#6d5bd0",
  adwaita: "#3584e4",
  "adwaita-dark": "#3584e4",
};

export function effectiveAccent(config: ExtensionConfig): string {
  return config.accentColor ?? ACCENTS[config.theme];
}

export function applyAppearance(config: ExtensionConfig): void {
  document.documentElement.dataset.theme = config.theme;
  document.documentElement.style.setProperty(
    "--accent",
    effectiveAccent(config),
  );
}
