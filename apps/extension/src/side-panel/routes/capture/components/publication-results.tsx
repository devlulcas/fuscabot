import type { PublicationResult } from "../../../../shared/api.ts";
import {
  safeDiscordMessageUrl,
  safeWebUrl,
} from "../../../../shared/ui_security.ts";
import { Button } from "../../../components/actions/button.tsx";
import css from "./publication-results.module.css";

export function PublicationResults({
  result,
  retryingWebsite,
  retryingDiscord,
  onRetryWebsite,
  onRetryDiscord,
}: {
  result: PublicationResult;
  retryingWebsite: boolean;
  retryingDiscord: boolean;
  onRetryWebsite: () => void;
  onRetryDiscord: (deliveryId: string) => void;
}) {
  return (
    <section className={css.resultPanel} aria-live="polite">
      <h2>Publication results</h2>
      <PublicationResultRow
        label="Fuscabot Archive"
        result={result.website}
        retrying={retryingWebsite}
        onRetry={onRetryWebsite}
        linkLabel="Open page"
      />
      <PublicationResultRow
        label="Discord"
        result={result.discord}
        retrying={retryingDiscord}
        onRetry={(id) => onRetryDiscord(id)}
        linkLabel="Open message"
      />
    </section>
  );
}

function PublicationResultRow({
  label,
  result,
  retrying,
  onRetry,
  linkLabel,
}: {
  label: string;
  result: PublicationResult["website"];
  retrying: boolean;
  onRetry: (deliveryId: string) => void;
  linkLabel: string;
}) {
  const url = label === "Discord"
    ? safeDiscordMessageUrl(result.url)
    : safeWebUrl(result.url);
  return (
    <div className={css.resultRow}>
      <div>
        <strong>{label}</strong>
        <span>{publicationStatus(result.status)}</span>
        {result.error ? <small>{result.error}</small> : null}
      </div>
      {url
        ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {linkLabel}
          </a>
        )
        : result.retryable && (label !== "Discord" || result.deliveryId)
        ? (
          <Button
            type="button"
            disabled={retrying}
            onClick={() => onRetry(result.deliveryId ?? "")}
          >
            {retrying
              ? "Retrying…"
              : label === "Discord"
              ? "Retry Discord"
              : "Retry website"}
          </Button>
        )
        : null}
    </div>
  );
}

function publicationStatus(status: PublicationResult["website"]["status"]) {
  switch (status) {
    case "published":
      return "Published";
    case "already_published":
      return "Already public";
    case "sent":
      return "Sent";
    case "already_sent":
      return "Already sent";
    case "failed":
      return "Failed";
    case "unavailable":
      return "Unavailable";
    case "not_requested":
      return "Not requested";
  }
}
