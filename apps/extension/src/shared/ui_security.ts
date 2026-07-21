export function escapeHtml(value: unknown = ""): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!);
}

export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username &&
        !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safeDiscordMessageUrl(value: unknown): string | null {
  const safe = safeWebUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.protocol === "https:" && url.hostname === "discord.com" &&
      /^\/channels\/\d+\/\d+\/\d+$/.test(url.pathname) && !url.search &&
      !url.hash
    ? url.href
    : null;
}
