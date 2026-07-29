import {
  type ExtensionConfig,
  UI_THEMES,
  type UiTheme,
} from "../../../../shared/config.ts";
import { effectiveAccent } from "../model/appearance.ts";
import { Button } from "../../../components/actions/button.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./appearance-settings.module.css";

export function AppearanceSettings({
  config,
  onThemeChange,
  onAccentChange,
  onAccentBlur,
  onResetAccent,
}: {
  config: ExtensionConfig;
  onThemeChange: (theme: UiTheme) => void;
  onAccentChange: (accentColor: string) => void;
  onAccentBlur: (accentColor: string) => void;
  onResetAccent: () => void;
}) {
  return (
    <Card as="section" className={css.settingsCard}>
      <h2>Appearance</h2>
      <Form>
        <label>
          Theme<select
            value={config.theme}
            onChange={(event) => onThemeChange(event.target.value as UiTheme)}
          >
            {UI_THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {theme === "botanical-dark"
                  ? "Botanical Dark"
                  : titleCase(theme)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Accent Color<input
            name="accentColor"
            type="color"
            value={effectiveAccent(config)}
            onChange={(event) => onAccentChange(event.target.value)}
            onBlur={(event) => onAccentBlur(event.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          onClick={onResetAccent}
        >
          Use Theme Default
        </Button>
      </Form>
    </Card>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
