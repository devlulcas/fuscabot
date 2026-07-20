const root = new URL("../", import.meta.url);
const source = new URL("src/", root);
const output = new URL("dist/", root);

await Deno.remove(output, { recursive: true }).catch((error: unknown) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(new URL("side-panel/", output), { recursive: true });
await Promise.all([
  Deno.copyFile(
    new URL("manifest.json", root),
    new URL("manifest.json", output),
  ),
  Deno.copyFile(
    new URL("side-panel/index.html", source),
    new URL("side-panel/index.html", output),
  ),
  Deno.copyFile(
    new URL("side-panel/styles.css", source),
    new URL("side-panel/styles.css", output),
  ),
]);

await bundle("service-worker.ts", "service-worker.js");
await bundle("side-panel/app.ts", "side-panel/app.js");

async function bundle(input: string, destination: string): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--quiet",
      "--output",
      new URL(destination, output).pathname,
      new URL(input, source).pathname,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const result = await command.output();
  if (!result.success) throw new Error(`Could not bundle ${input}`);
}

console.log("Built unpacked extension in apps/extension/dist");
