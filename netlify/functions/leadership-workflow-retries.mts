import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"
import { drainJobs } from "../../src/lib/leadership-workflows/worker"
export default async function leadershipWorkflowRetries() {
  if (Netlify.env.get("WORKFLOW_INTEGRATION_MODE") !== "live")
    return new Response("Disabled")
  const url = Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"),
    key = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return new Response("Setup pending", { status: 503 })
  await drainJobs(createClient(url, key))
  return new Response("Delivery queue processed")
}

export const config: Config = { schedule: "* * * * *" }
