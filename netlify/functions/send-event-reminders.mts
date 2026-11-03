import type { Config, Context } from "@netlify/functions"
import { processDueEventReminders } from "../../src/lib/events/email-service"
import { processGuestEventEmails } from "../../src/lib/guest-events/service"

export default async function sendEventReminders(_request: Request, context: Context) {
  if (context.deploy.context === "deploy-preview") return new Response("Background actions are disabled in deploy previews", { status: 403 })

  try {
    const [result, guestResult] = await Promise.all([processDueEventReminders(), processGuestEventEmails()])
    console.log("[send-event-reminders]", JSON.stringify(result))

    return new Response(JSON.stringify({ ok: true, result, guestResult }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[send-event-reminders] failed:", message)

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const config: Config = {
  schedule: "*/10 * * * *",
}
