export type LibraryFilters = {
  q: string;
  state?: "inbox" | "read_later" | "shared";
  visibility?: "public" | "private";
  domain?: string;
  enrichmentStatus?: "preparing" | "ready" | "failed";
  sort: "newest" | "oldest" | "updated";
  page: number;
};

export function parseLibrarySearch(params: URLSearchParams): LibraryFilters {
  const state = oneOf(
    params.get("state"),
    ["inbox", "read_later", "shared"] as const,
  );
  const visibility = oneOf(
    params.get("visibility"),
    ["public", "private"] as const,
  );
  const enrichmentStatus = oneOf(
    params.get("status"),
    ["preparing", "ready", "failed"] as const,
  );
  const sort =
    oneOf(params.get("sort"), ["newest", "oldest", "updated"] as const) ??
      "newest";
  const rawPage = Number(params.get("page"));
  return {
    q: params.get("q")?.trim() ?? "",
    state,
    visibility,
    domain: params.get("domain")?.trim() || undefined,
    enrichmentStatus,
    sort,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function librarySearchParams(filters: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.state) params.set("state", filters.state);
  if (filters.visibility) params.set("visibility", filters.visibility);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.enrichmentStatus) params.set("status", filters.enrichmentStatus);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

function oneOf<T extends string>(
  value: string | null,
  values: readonly T[],
): T | undefined {
  return values.find((candidate) => candidate === value);
}
