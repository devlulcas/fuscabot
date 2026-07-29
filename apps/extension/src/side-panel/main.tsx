import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { getConfig } from "../shared/config.ts";
import { onSessionInvalidated } from "../shared/hono-client.ts";
import { applyAppearance } from "./routes/settings/model/appearance.ts";
import { createAppQueryClient } from "./app/query-client.ts";
import { RestoreGate } from "./app/restore-gate.tsx";
import { resetCacheIdentity } from "./platform/cache-identity.ts";
import { settingsQueryKeys } from "./routes/settings/api/settings.queries.ts";
import { indexedDbPersister } from "./platform/indexed-db-persister.ts";
import { installRuntimeBridge } from "./platform/runtime-bridge.ts";
import { router } from "./router.tsx";
import "./styles/tokens.css";
import "./styles/base.css";

const DAY = 24 * 60 * 60 * 1_000;
const config = await getConfig();
applyAppearance(config);
const queryClient = createAppQueryClient();
queryClient.setQueryData(settingsQueryKeys.config, config);
installRuntimeBridge(queryClient);
onSessionInvalidated(async () => {
  await resetCacheIdentity(queryClient);
  globalThis.location.reload();
});
const root = document.querySelector("#root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: indexedDbPersister,
        maxAge: DAY,
        buster: `v1:${config.sessionId ?? "anonymous"}`,
        dehydrateOptions: {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && query.meta?.persist !== false,
        },
      }}
    >
      <RestoreGate>
        <RouterProvider router={router} />
      </RestoreGate>
    </PersistQueryClientProvider>
  </StrictMode>,
);
