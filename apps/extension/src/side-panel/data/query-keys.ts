export const queryKeys = {
  config: ["config"] as const,
  session: ["auth", "session"] as const,
  guilds: ["discord", "guilds"] as const,
  pendingCapture: (id: string) => ["pending-capture", id] as const,
  resources: ["resources"] as const,
  resource: (id: string) => ["resources", "detail", id] as const,
  resourceLists: ["resources", "list"] as const,
  resourceList: (
    filters: Record<string, string | number | boolean | undefined>,
  ) => ["resources", "list", filters] as const,
  channels: ["channels"] as const,
  tags: ["tags"] as const,
  tagList: (search = "") => ["tags", { search }] as const,
};
