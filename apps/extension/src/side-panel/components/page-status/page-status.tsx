import styles from "./page-status.module.css";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function PageError(
  { error, retry }: { error: unknown; retry?: () => void },
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <section className={`${styles.notice} ${styles.error}`} role="alert">
      <h1>Something Went Wrong</h1>
      <p>{message}</p>
      {retry ? <button type="button" onClick={retry}>Retry</button> : null}
    </section>
  );
}

export function InlineNotice(
  { children, error = false }: { children: React.ReactNode; error?: boolean },
) {
  return (
    <p
      className={`${styles.notice} ${error ? styles.error : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
