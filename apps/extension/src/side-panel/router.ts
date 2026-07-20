export function parseRoute(hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [name = "library", id] = raw.split("/");
  if (name === "capture") return { name, captureId: id };
  if (name === "settings") return { name };
  return { name: "library" };
}
