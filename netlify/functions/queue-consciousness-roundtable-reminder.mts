import type { Config } from "@netlify/functions"
import { queueEventRegistrationReminderNow } from "../../src/lib/member-notifications/email-service"

const EVENT_ID = "7dc2bd55-4852-49be-a53c-9d5c60f4d7a0"
const EVENT_TITLE = "IPN Labs Roundtable Talk: The Science of Consciousness"
const SEND_AT = "2026-08-26T13:30:00.000Z"

export function consciousnessRoundtableReminderIsDue(now: Date) {
  return (
    now.toISOString().slice(0, 10) === "2026-08-26" &&
    now.getTime() >= Date.parse(SEND_AT)
  )
}

export default async function queueConsciousnessRoundtableReminder() {
  const now = new Date()
  if (!consciousnessRoundtableReminderIsDue(now)) {
    return new Response(JSON.stringify({ ok: true, skipped: "outside one-off send date" }), {
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const queued = await queueEventRegistrationReminderNow(EVENT_ID, now)
    console.log(
      "[queue-consciousness-roundtable-reminder]",
      JSON.stringify({ eventId: EVENT_ID, eventTitle: EVENT_TITLE, sendAt: SEND_AT, queued }),
    )
    return new Response(JSON.stringify({ ok: true, queued }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[queue-consciousness-roundtable-reminder] failed:", message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const config: Config = {
  // 9:30 AM America/New_York on August 26. The runtime date guard makes this 2026-only.
  schedule: "30 13 26 8 *",
}
