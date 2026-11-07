import { defineConfig } from "@playwright/test"
const baseURL = `http://127.0.0.1:${process.env.PERFORMANCE_PORT || "4341"}`
export default defineConfig({
  testDir: "./qa/performance", testMatch: "*.spec.ts", workers: 1, retries: 0,
  use: { baseURL, viewport: { width: 1440, height: 1000 } },
  webServer: { command: "npm run performance:dev", url: `${baseURL}/performance-preview`, reuseExistingServer: !process.env.CI, timeout: 120000 },
  outputDir: "test-results-performance",
  reporter: "list",
})
