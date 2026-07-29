import { useQuery } from "@tanstack/react-query";
import { PageLoading } from "../../../components/page-status/page-status.tsx";
import { pendingCaptureQueryOptions } from "../api/captures.queries.ts";
import { ManualCapture } from "./manual-capture.tsx";
import { ResourceEditor } from "./resource-editor.tsx";
import { Eyebrow } from "../../../components/typography/eyebrow.tsx";
import { PageStack } from "../../../components/layout/page-stack.tsx";

export function CaptureById({ captureId }: { captureId: string }) {
  const pending = useQuery(pendingCaptureQueryOptions(captureId));
  if (pending.isPending) return <PageLoading label="Reading capture state…" />;
  if (pending.data?.state === "failed") {
    return (
      <ManualCapture
        fallback={pending.data.fallback}
        error={pending.data.error}
      />
    );
  }
  if (
    pending.data?.state === "extracting" || pending.data?.state === "preparing"
  ) {
    return (
      <PageStack>
        <Eyebrow>New Capture</Eyebrow>
        <h1>
          {pending.data.state === "extracting"
            ? "Reading Page"
            : "Saving Capture"}
        </h1>
        <PageLoading label="This view updates automatically…" />
      </PageStack>
    );
  }
  return <ResourceEditor resourceId={pending.data?.resourceId ?? captureId} />;
}
