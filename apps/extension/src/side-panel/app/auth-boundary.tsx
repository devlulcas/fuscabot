import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  configQueryOptions,
  sessionQueryOptions,
} from "../routes/settings/api/settings.queries.ts";
import {
  PageError,
  PageLoading,
} from "../components/page-status/page-status.tsx";
import { ButtonLink } from "../components/actions/button-link.tsx";
import { Muted } from "../components/typography/muted.tsx";
import { PageStack } from "../components/layout/page-stack.tsx";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const config = useQuery(configQueryOptions());
  const session = useQuery({
    ...sessionQueryOptions(),
    enabled: Boolean(config.data?.accessToken),
  });
  if (config.isPending || (config.data?.accessToken && session.isPending)) {
    return <PageLoading label="Checking your session…" />;
  }
  if (config.isError) {
    return (
      <PageError
        error={config.error}
        retry={() => void config.refetch()}
      />
    );
  }
  if (config.data?.accessToken && session.isError) {
    return (
      <PageError
        error={new Error(
          "Couldn’t verify your Discord session. Check your connection and try again.",
        )}
        retry={() => void session.refetch()}
      />
    );
  }
  if (!config.data?.accessToken) {
    return (
      <PageStack>
        <h1>Connect Discord</h1>
        <Muted>
          Connect your account in Settings to use this page.
        </Muted>
        <ButtonLink
          to="/settings"
          state={{ returnTo: `${location.pathname}${location.search}` }}
        >
          Open Settings
        </ButtonLink>
      </PageStack>
    );
  }
  return children;
}
