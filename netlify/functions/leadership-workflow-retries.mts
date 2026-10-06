import { createClient } from "@supabase/supabase-js"
import { schedule } from "@netlify/functions"
import { drainJobs } from "../../src/lib/leadership-workflows/worker"
export const handler = schedule("* * * * *", async () => {
  if (process.env.WORKFLOW_INTEGRATION_MODE !== "live")
    return { statusCode: 200, body: "Disabled" }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { statusCode: 503, body: "Setup pending" }
  await drainJobs(createClient(url, key))
  return { statusCode: 200, body: "Delivery queue processed" }
})
