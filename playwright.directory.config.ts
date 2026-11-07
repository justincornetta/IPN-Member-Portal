import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./qa/directory", testMatch: "*.spec.ts", workers: 1, retries: 0,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4342", viewport: { width: 1440, height: 1000 } },
  webServer: { command: "npm run directory:dev", url: "http://127.0.0.1:4342/dashboard/directory", reuseExistingServer: !process.env.CI, timeout: 120000 },
  reporter: "list",
})
