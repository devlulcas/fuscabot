import { useIsRestoring } from "@tanstack/react-query";
import { PageLoading } from "../components/page-status/page-status.tsx";

export function RestoreGate({ children }: { children: React.ReactNode }) {
  return useIsRestoring()
    ? <PageLoading label="Restoring library…" />
    : children;
}
