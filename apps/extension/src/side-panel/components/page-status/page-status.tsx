import css from "./page-status.module.css";
import { Button } from "../actions/button.tsx";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={css.loading} role="status">
      <span className={css.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function PageError(
  { error, retry }: { error: unknown; retry?: () => void },
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <section className={`${css.notice} ${css.error}`} role="alert">
      <h1>Something Went Wrong</h1>
      <p>{message}</p>
      {retry ? <Button type="button" onClick={retry}>Retry</Button> : null}
    </section>
  );
}

export function InlineNotice(
  { children, error = false }: { children: React.ReactNode; error?: boolean },
) {
  return (
    <p
      className={`${css.notice} ${error ? css.error : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
