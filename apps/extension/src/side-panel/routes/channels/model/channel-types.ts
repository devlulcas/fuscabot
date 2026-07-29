import { api } from "../../../../shared/api.ts";

export type ChannelPatch = Parameters<typeof api.updateChannel>[1];
