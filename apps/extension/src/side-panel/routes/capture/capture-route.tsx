import { useParams } from "react-router-dom";
import { CaptureById } from "./components/capture-by-id.tsx";
import { ManualCapture } from "./components/manual-capture.tsx";

export function CaptureRoute() {
  const { captureId } = useParams();
  if (!captureId) return <ManualCapture />;
  return <CaptureById captureId={captureId} />;
}
