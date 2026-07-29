import { Button } from "../../../components/actions/button.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./api-settings.module.css";

export function ApiSettings({
  apiBaseUrl,
  saving,
  onDirty,
  onSave,
}: {
  apiBaseUrl: string;
  saving: boolean;
  onDirty: () => void;
  onSave: (baseUrl: string) => void;
}) {
  return (
    <Card as="section" className={css.settingsCard}>
      <Form
        onInput={onDirty}
        onSubmit={(event) => {
          event.preventDefault();
          const base = new FormData(event.currentTarget).get("apiBaseUrl");
          if (typeof base === "string") onSave(base);
        }}
      >
        <h2>API</h2>
        <label>
          API Base URL<input
            name="apiBaseUrl"
            type="url"
            required
            autoComplete="off"
            defaultValue={apiBaseUrl}
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
        >
          Save API URL
        </Button>
      </Form>
    </Card>
  );
}
