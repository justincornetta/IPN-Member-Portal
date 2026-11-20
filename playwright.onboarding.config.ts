import { defineConfig } from "@playwright/test"
const baseURL = `http://127.0.0.1:${process.env.ONBOARDING_PORT || "4360"}`
export default defineConfig({
  testDir: "./qa/onboarding", testMatch: "*.spec.ts", workers: 1, retries: 0,
  use: { baseURL },
  webServer: { command: "node scripts/onboarding-dev.mjs", url: `${baseURL}/onboarding/whatsapp?motion=editorial`, reuseExistingServer: !process.env.CI, timeout: 120000 },
  outputDir: "test-results/onboarding", reporter: "list",
})
