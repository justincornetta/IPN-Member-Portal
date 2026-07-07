import type { Config } from "@netlify/functions"
import { processDueEventReminders } from "../../src/lib/events/email-service"

export default async function sendEventReminders() {
  try {
    const result = await processDueEventReminders()
    console.log("[send-event-reminders]", JSON.stringify(result))

    return new Response(JSON.stringify({ ok: true, result }), {
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
