export type Route =
  | { name: "library" }
  | { name: "settings" }
  | { name: "capture"; captureId?: string };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [name = "library", id] = raw.split("/");
  if (name === "capture") return { name, captureId: id };
  if (name === "settings") return { name };
  return { name: "library" };
}
