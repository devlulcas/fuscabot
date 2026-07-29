import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Actions } from "../actions/actions.tsx";
import { Button } from "../actions/button.tsx";
import { Muted } from "../typography/muted.tsx";
import css from "./unsaved-changes.module.css";

export function UnsavedChanges({ when }: { when: boolean }) {
  const blocker = useBlocker(when);
  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = "";
  });
  if (blocker.state !== "blocked") return null;
  return (
    <div className={css.dialogBackdrop}>
      <section
        className={css.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <h2 id="unsaved-title">Discard Unsaved Changes?</h2>
        <Muted>Your edits have not been saved.</Muted>
        <Actions>
          <Button type="button" onClick={() => blocker.reset()}>
            Keep Editing
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => blocker.proceed()}
          >
            Discard Changes
          </Button>
        </Actions>
      </section>
    </div>
  );
}
