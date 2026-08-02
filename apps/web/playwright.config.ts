import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "WEB_E2E_FIXTURES=1 deno task dev --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !Deno.env.get("CI"),
  },
});
