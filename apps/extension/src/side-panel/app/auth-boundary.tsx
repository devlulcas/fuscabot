import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { configQuery, sessionQuery } from "../data/queries.ts";
import { PageLoading } from "../components/page-status/page-status.tsx";
import page from "../components/layout/page.module.css";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const config = useQuery(configQuery());
  const session = useQuery({
    ...sessionQuery(),
    enabled: Boolean(config.data?.accessToken),
  });
  if (config.isPending || (config.data?.accessToken && session.isPending)) {
    return <PageLoading label="Checking your session…" />;
  }
  if (!config.data?.accessToken || session.isError) {
    return (
      <section className={page.stack}>
        <h1>Connect Discord</h1>
        <p className={page.muted}>
          Connect your account in Settings to use this page.
        </p>
        <Link
          className={page.buttonLink}
          to="/settings"
          state={{ returnTo: `${location.pathname}${location.search}` }}
        >
          Open Settings
        </Link>
      </section>
    );
  }
  return children;
}
