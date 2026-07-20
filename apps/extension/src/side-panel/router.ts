export type Route =
  | { name: "library" }
  | { name: "settings" }
  | { name: "channels" }
  | { name: "tags" }
  | { name: "capture"; captureId?: string };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [name = "library", id] = raw.split("/");
  if (name === "capture") return { name, captureId: id };
  if (name === "settings" || name === "channels" || name === "tags") {
    return { name };
  }
  return { name: "library" };
}
