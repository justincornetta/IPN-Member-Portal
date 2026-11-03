import type { Config, Context } from "@netlify/functions"
import {
  processPendingMemberNotifications,
  queueDueEventRegistrationReminders,
} from "../../src/lib/member-notifications/email-service"

export default async function sendMemberNotifications(_request: Request, context: Context) {
  if (context.deploy.context === "deploy-preview") return new Response("Background actions are disabled in deploy previews", { status: 403 })

  try {
    const queued = await queueDueEventRegistrationReminders()
    const result = await processPendingMemberNotifications()
    console.log("[send-member-notifications]", JSON.stringify({ queued, result }))

    return new Response(JSON.stringify({ ok: true, queued, result }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[send-member-notifications] failed:", message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const config: Config = {
  schedule: "*/5 * * * *",
}
