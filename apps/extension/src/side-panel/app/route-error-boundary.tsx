import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import page from "../components/layout/page.module.css";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${String(error.data)}`
    : error instanceof Error
    ? error.message
    : "Unknown route error";
  return (
    <section className={page.stack} role="alert">
      <h1>Page Unavailable</h1>
      <p className={page.muted}>{message}</p>
      <Link className={page.buttonLink} to="/library">Open Library</Link>
    </section>
  );
}
