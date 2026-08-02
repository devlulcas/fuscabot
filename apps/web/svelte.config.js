import adapter from "@deno/svelte-adapter";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csrf: { trustedOrigins: ["*"] },
    files: { assets: "public" },
    alias: {
      "@fuscabot/api": fileURLToPath(new URL("../api/mod.ts", import.meta.url)),
      "@fuscabot/contracts": fileURLToPath(
        new URL("../../packages/contracts/mod.ts", import.meta.url),
      ),
    },
  },
};

export default config;
