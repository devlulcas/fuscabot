import {
  type ApiResource,
  canonicalYouTubeUrl,
  youtubeThumbnailUrl,
} from "../../../../shared/types.ts";
import { safeWebUrl } from "../../../../shared/ui_security.ts";
import { PlayIcon } from "../../../components/icons/icons.tsx";
import { Actions } from "../../../components/actions/actions.tsx";
import { ButtonLink } from "../../../components/actions/button-link.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Muted } from "../../../components/typography/muted.tsx";
import { StatusBadge } from "../../../components/typography/status-badge.tsx";
import css from "./library-resource-item.module.css";

export function LibraryResourceItem({
  resource,
  selected,
  disabled,
  onToggle,
}: {
  resource: ApiResource;
  selected: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const youtubeUrl = canonicalYouTubeUrl(resource.normalizedUrl);
  const thumbnailUrl = youtubeThumbnailUrl(resource.normalizedUrl);
  return (
    <Card
      as="article"
      className={`${css.resource} ${thumbnailUrl ? css.resourceWithMedia : ""}`}
    >
      <input
        type="checkbox"
        aria-label={`Select ${resource.title}`}
        checked={selected}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
      />
      {youtubeUrl && thumbnailUrl
        ? (
          <a
            className={css.resourceMedia}
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Play ${resource.title} on YouTube`}
          >
            <img
              src={thumbnailUrl}
              alt=""
              width="96"
              height="54"
              loading="lazy"
            />
            <span aria-hidden="true">
              <PlayIcon />
            </span>
          </a>
        )
        : null}
      <div className={css.resourceCopy}>
        <div className={css.resourceTitle}>
          <strong>{resource.title}</strong>
          {youtubeUrl ? <StatusBadge>YouTube</StatusBadge> : null}
          {resource.publicPublication
            ? <StatusBadge variant="public">Public</StatusBadge>
            : null}
        </div>
        <Muted as="span" className={css.truncate}>
          {safeWebUrl(resource.originalUrl)}
        </Muted>
      </div>
      <Actions className={css.resourceActions}>
        <a
          href={safeWebUrl(resource.originalUrl) ?? "about:blank"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Source
        </a>
        <ButtonLink size="compact" to={`/capture/${resource.id}`}>
          Review
        </ButtonLink>
      </Actions>
    </Card>
  );
}
