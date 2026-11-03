import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./qa/guest-events", workers: 1, retries: 0,
  use: { baseURL: "http://127.0.0.1:4331" },
  webServer: { command: "npm run guest-events:dev", url: "http://127.0.0.1:4331/events/guest-rsvp-preview", reuseExistingServer: !process.env.CI, timeout: 120000 },
  reporter: "list"
})
