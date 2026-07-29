import type { DiscordChannel } from "../../../../shared/api.ts";
import { Actions } from "../../../components/actions/actions.tsx";
import { Button } from "../../../components/actions/button.tsx";
import { Form } from "../../../components/form/form.tsx";
import { Row } from "../../../components/layout/row.tsx";
import { Muted } from "../../../components/typography/muted.tsx";
import { StatusBadge } from "../../../components/typography/status-badge.tsx";
import css from "./channel-form.module.css";
import type { ChannelPatch } from "../model/channel-types.ts";

export function ChannelForm({
  channel,
  pending,
  onDirty,
  onSave,
}: {
  channel: DiscordChannel;
  pending: boolean;
  onDirty: () => void;
  onSave: (patch: ChannelPatch) => void;
}) {
  return (
    <Form
      className={css.channelRow}
      onInput={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const description = data.get("routingDescription");
        onSave({
          routingDescription:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          isActiveForRouting: data.get("active") === "on",
        });
      }}
    >
      <Row>
        <div className={css.channelIdentity}>
          <span className={css.channelHash} aria-hidden="true">#</span>
          <div className={css.channelTitle}>
            <strong>{channel.name}</strong>
            <span>{channel.parentName ?? "No Category"}</span>
          </div>
        </div>
        <div className={css.channelControls}>
          {channel.availability !== "available"
            ? (
              <StatusBadge variant="failed">
                Unavailable
              </StatusBadge>
            )
            : null}
          <label className={css.switch}>
            <input
              type="checkbox"
              name="active"
              defaultChecked={channel.isActiveForRouting}
              disabled={channel.availability !== "available"}
            />{" "}
            Active for Routing
          </label>
        </div>
      </Row>
      <Muted>{channel.discordTopic ?? "No Discord topic"}</Muted>
      <label>
        Routing Description<textarea
          name="routingDescription"
          defaultValue={channel.routingDescription ?? ""}
          placeholder="What belongs in this channel?…"
        />
      </label>
      <Actions className={css.channelActions}>
        <Button
          type="submit"
          size="compact"
          disabled={pending}
        >
          Save Routing
        </Button>
      </Actions>
    </Form>
  );
}
