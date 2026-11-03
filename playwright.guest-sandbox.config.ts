import {defineConfig} from "@playwright/test"
export default defineConfig({
  testDir:"./qa/guest-sandbox",workers:1,retries:0,
  use:{baseURL:"http://127.0.0.1:4341"},
  webServer:{command:"node scripts/guest-sandbox-start.mjs",url:"http://127.0.0.1:4341/events/guest-rsvp-preview",reuseExistingServer:process.env.QA_REUSE_SERVER==="1",timeout:120000},
  reporter:"list",
})
