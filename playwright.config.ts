import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: 1,
  reporter: "list",
  // The mdv server binds to 127.0.0.1; headless Chromium runs locally too.
  use: {
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});