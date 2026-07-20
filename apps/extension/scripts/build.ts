const root = new URL("../", import.meta.url);
const source = new URL("src/", root);
const output = new URL("dist/", root);
await Deno.remove(output, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(output, { recursive: true });
await copyTree(source, output);
await Deno.copyFile(
  new URL("manifest.json", root),
  new URL("manifest.json", output),
);

async function copyTree(from, to) {
  for await (const entry of Deno.readDir(from)) {
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith("_test.ts")) {
      continue;
    }
    const input = new URL(entry.name, from);
    const outputName = entry.name.endsWith(".ts")
      ? entry.name.replace(/\.ts$/, ".js")
      : entry.name;
    const destination = new URL(outputName, to);
    if (entry.isDirectory) {
      await Deno.mkdir(destination, { recursive: true });
      await copyTree(
        new URL(`${entry.name}/`, from),
        new URL(`${outputName}/`, to),
      );
    } else if (entry.name.endsWith(".ts")) {
      const text = await Deno.readTextFile(input);
      await Deno.writeTextFile(
        destination,
        text.replaceAll(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2"),
      );
    } else await Deno.copyFile(input, destination);
  }
}

console.log("Built unpacked extension in apps/extension/dist");
