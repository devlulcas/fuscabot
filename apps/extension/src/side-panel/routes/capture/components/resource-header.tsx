import {
  type ApiResource,
  canonicalYouTubeUrl,
} from "../../../../shared/types.ts";
import { Eyebrow } from "../../../components/typography/eyebrow.tsx";
import { StatusBadge } from "../../../components/typography/status-badge.tsx";
import css from "./resource-header.module.css";

export function ResourceHeader({ item }: { item: ApiResource }) {
  return (
    <div className={css.titleRow}>
      <div>
        <Eyebrow>Captured</Eyebrow>
        <h1>Review Draft</h1>
      </div>
      <div className={css.badges}>
        {canonicalYouTubeUrl(item.normalizedUrl)
          ? <StatusBadge>YouTube</StatusBadge>
          : null}
        {item.publicPublication
          ? <StatusBadge variant="public">Public</StatusBadge>
          : null}
        <StatusBadge
          variant={item.enrichmentStatus === "ready"
            ? "ready"
            : item.enrichmentStatus === "failed"
            ? "failed"
            : "default"}
        >
          {item.enrichmentStatus}
        </StatusBadge>
      </div>
    </div>
  );
}
