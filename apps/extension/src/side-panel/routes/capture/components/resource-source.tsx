import type { ApiResource } from "../../../../shared/types.ts";
import {
  canonicalYouTubeUrl,
  youtubeThumbnailUrl,
} from "../../../../shared/types.ts";
import { safeWebUrl } from "../../../../shared/ui_security.ts";
import {
  ArrowUpRightIcon,
  PlayIcon,
} from "../../../components/icons/icons.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Muted } from "../../../components/typography/muted.tsx";
import css from "./resource-source.module.css";

export function ResourceSource({ item }: { item: ApiResource }) {
  const youtubeUrl = canonicalYouTubeUrl(item.normalizedUrl);
  const thumbnail = youtubeThumbnailUrl(item.normalizedUrl);
  return (
    <Card as="article" className={css.source}>
      {youtubeUrl && thumbnail
        ? (
          <a
            className={css.videoPreview}
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Play ${item.title} on YouTube`}
          >
            <img src={thumbnail} alt="" width="480" height="270" />
            <span aria-hidden="true">
              <PlayIcon />
            </span>
          </a>
        )
        : null}
      <strong>{item.title}</strong>
      <Muted
        as="a"
        className={css.sourceLink}
        href={safeWebUrl(item.originalUrl) ?? "about:blank"}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.sourceDomain} <ArrowUpRightIcon />
      </Muted>
      {item.selectedQuote
        ? <blockquote>“{item.selectedQuote}”</blockquote>
        : null}
    </Card>
  );
}
