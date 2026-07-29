import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ButtonLink } from "../components/actions/button-link.tsx";
import { Muted } from "../components/typography/muted.tsx";
import { PageStack } from "../components/layout/page-stack.tsx";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${String(error.data)}`
    : error instanceof Error
    ? error.message
    : "Unknown route error";
  return (
    <PageStack role="alert">
      <h1>Page Unavailable</h1>
      <Muted>{message}</Muted>
      <ButtonLink to="/library">Open Library</ButtonLink>
    </PageStack>
  );
}
