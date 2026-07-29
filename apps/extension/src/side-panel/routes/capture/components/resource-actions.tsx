import { Actions } from "../../../components/actions/actions.tsx";
import { Button } from "../../../components/actions/button.tsx";

export function ResourceActions({
  busy,
  publishable,
  saving,
  sending,
  publishing,
  onSave,
  onReadLater,
}: {
  busy: boolean;
  publishable: boolean;
  saving: boolean;
  sending: boolean;
  publishing: boolean;
  onSave: (form: HTMLFormElement | null) => void;
  onReadLater: (form: HTMLFormElement | null) => void;
}) {
  return (
    <Actions>
      <Button
        type="button"
        disabled={busy}
        onClick={(event) => onSave(event.currentTarget.form)}
      >
        {saving ? "Saving…" : "Save Draft"}
      </Button>
      <Button
        type="button"
        disabled={!publishable || busy}
        onClick={(event) => onReadLater(event.currentTarget.form)}
      >
        {sending ? "Saving & Sending…" : "Read Later"}
      </Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {publishing ? "Saving & Publishing…" : "Publish"}
      </Button>
    </Actions>
  );
}
