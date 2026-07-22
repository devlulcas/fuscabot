import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./app/app-shell.tsx";
import { AuthBoundary } from "./app/auth-boundary.tsx";
import { RouteErrorBoundary } from "./app/route-error-boundary.tsx";
import { CaptureRoute } from "./routes/capture/capture-route.tsx";
import { ChannelsRoute } from "./routes/channels/channels-route.tsx";
import { LibraryRoute } from "./routes/library/library-route.tsx";
import { SettingsRoute } from "./routes/settings/settings-route.tsx";
import { TagsRoute } from "./routes/tags/tags-route.tsx";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const protectedElement = (element: React.ReactNode) => (
  <AuthBoundary>{element}</AuthBoundary>
);

export const router = createHashRouter([{
  path: "/",
  element: <AppShell />,
  errorElement: <RouteErrorBoundary />,
  children: [
    { index: true, element: <Navigate to="/library" replace /> },
    { path: "capture", element: protectedElement(<CaptureRoute />) },
    {
      path: "capture/:captureId",
      loader: ({ params }) => {
        if (
          !params.captureId || !UUID.test(params.captureId)
        ) throw new Response("Invalid capture ID", { status: 400 });
        return null;
      },
      element: protectedElement(<CaptureRoute />),
    },
    { path: "library", element: protectedElement(<LibraryRoute />) },
    { path: "channels", element: protectedElement(<ChannelsRoute />) },
    { path: "tags", element: protectedElement(<TagsRoute />) },
    { path: "settings", element: <SettingsRoute /> },
    {
      path: "*",
      element: (
        <section role="alert">
          <h1>Page Not Found</h1>
        </section>
      ),
    },
  ],
}]);
