import type { DiscordGuild } from "../../../../shared/api.ts";
import type { ExtensionConfig } from "../../../../shared/config.ts";
import { Button } from "../../../components/actions/button.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./guild-sync-form.module.css";

export function GuildSyncForm({
  config,
  guilds,
  pending,
  onSync,
}: {
  config: ExtensionConfig | undefined;
  guilds: DiscordGuild[];
  pending: boolean;
  onSync: (guildId: string) => void;
}) {
  return (
    <Form
      className={css.guildSyncForm}
      onSubmit={(event) => {
        event.preventDefault();
        const guildId = new FormData(event.currentTarget).get("guildId");
        if (typeof guildId === "string" && guildId) onSync(guildId);
      }}
    >
      <label>
        Server<select
          name="guildId"
          defaultValue={config?.selectedGuildId ?? guilds[0]?.id}
        >
          {guilds.map((guild) => (
            <option key={guild.id} value={guild.id}>{guild.name}</option>
          ))}
        </select>
      </label>
      <Button
        type="submit"
        variant="primary"
        disabled={!guilds.length || pending}
      >
        {pending ? "Syncing…" : "Sync Channels Now"}
      </Button>
    </Form>
  );
}
