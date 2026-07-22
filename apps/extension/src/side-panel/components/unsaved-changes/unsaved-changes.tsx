import { useBeforeUnload, useBlocker } from "react-router-dom";
import styles from "../layout/page.module.css";

export function UnsavedChanges({ when }: { when: boolean }) {
  const blocker = useBlocker(when);
  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = "";
  });
  if (blocker.state !== "blocked") return null;
  return (
    <div className={styles.dialogBackdrop}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <h2 id="unsaved-title">Discard Unsaved Changes?</h2>
        <p className={styles.muted}>Your edits have not been saved.</p>
        <div className={styles.actions}>
          <button type="button" onClick={() => blocker.reset()}>
            Keep Editing
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => blocker.proceed()}
          >
            Discard Changes
          </button>
        </div>
      </section>
    </div>
  );
}
