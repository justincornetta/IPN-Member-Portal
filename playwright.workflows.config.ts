import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./qa/leadership",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4327",
    viewport: { width: 1440, height: 1000 }
  },
  webServer: {
    command: "npm run workflow:dev",
    url: "http://127.0.0.1:4327/workflow-preview/media",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  reporter: "list"
})
