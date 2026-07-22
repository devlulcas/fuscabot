import type { QueryClient } from "@tanstack/react-query";
import { indexedDbPersister } from "./indexed-db-persister.ts";

export async function resetCacheIdentity(
  queryClient: QueryClient,
): Promise<void> {
  queryClient.clear();
  await indexedDbPersister.removeClient();
}
