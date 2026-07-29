import type { DiscordChannel } from "../api/channels.select.ts";
import { Form } from "../../../components/form/form.tsx";
import css from "./read-later-destination.module.css";

export function ReadLaterDestination({
  value,
  channels,
  onChange,
}: {
  value: string;
  channels: DiscordChannel[];
  onChange: (next: string, previous: string) => void;
}) {
  return (
    <Form className={css.destinationForm}>
      <label>
        Read Later Destination<select
          value={value}
          onChange={(event) => onChange(event.target.value, value)}
        >
          <option value="">Not Configured</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
              {channel.parentName ? ` — ${channel.parentName}` : ""}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
