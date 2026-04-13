import { defineConfig, devices } from "@playwright/experimental-ct-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.ct.tsx",
  snapshotDir: "./src/__snapshots__",
  timeout: 10_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    ctPort: 3100,
    ctViteConfig: {
      plugins: [tailwindcss()],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
