import type { Config } from "@netlify/functions"
import {
  processPendingMemberNotifications,
  queueDueEventRegistrationReminders,
} from "../../src/lib/member-notifications/email-service"

export default async function sendMemberNotifications() {
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
