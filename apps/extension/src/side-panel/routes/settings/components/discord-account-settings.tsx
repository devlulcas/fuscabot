import type { UseQueryResult } from "@tanstack/react-query";
import type { DiscordSession } from "../../channels/api/channels.select.ts";
import { InlineNotice } from "../../../components/page-status/page-status.tsx";
import { Actions } from "../../../components/actions/actions.tsx";
import { Button } from "../../../components/actions/button.tsx";
import { Card } from "../../../components/layout/card.tsx";
import css from "./discord-account-settings.module.css";

export function DiscordAccountSettings({
  session,
  connecting,
  signingOut,
  onConnect,
  onLogout,
}: {
  session: UseQueryResult<DiscordSession, Error>;
  connecting: boolean;
  signingOut: boolean;
  onConnect: () => void;
  onLogout: () => void;
}) {
  const busy = connecting || signingOut;
  return (
    <Card as="section" className={css.settingsCard}>
      <h2>Discord Account</h2>
      {session.isError
        ? (
          <InlineNotice error>
            Couldn’t verify the connection. Your saved session was kept.
          </InlineNotice>
        )
        : (
          <InlineNotice>
            {session.isPending
              ? "Checking connection…"
              : session.data
              ? "Connected as the configured owner."
              : "Not connected."}
          </InlineNotice>
        )}
      <Actions>
        <Button
          type="button"
          disabled={busy}
          onClick={onConnect}
        >
          {connecting
            ? "Connecting…"
            : session.data
            ? "Reconnect Discord"
            : "Connect Discord"}
        </Button>
        {session.data
          ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={onLogout}
            >
              {signingOut ? "Signing Out…" : "Sign Out"}
            </Button>
          )
          : null}
      </Actions>
    </Card>
  );
}
