import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { demoEvent, previewGuest } from "./demo"
import { hostedGuestPreview } from "./preview-mode"
import { parseGuestInput, type GuestInput, type GuestRegistration } from "./domain"

// Test-only state belongs to this browser, not a shared serverless process/database.
// This is deliberately NOT an authentication cookie or a source of authorization.
const key = "ipn-rsvp-sandbox"
export async function readPreviewGuest(): Promise<GuestRegistration | null> {
  if (!hostedGuestPreview()) throw new Error("Sandbox unavailable")
  const value = (await cookies()).get(key)?.value
  if (!value || value.length > 3500) return null
  try {
    const raw = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    const input = parseGuestInput({ firstName: raw.first_name, lastName: raw.last_name, email: raw.email, marketingOptIn: raw.marketing_opt_in })
    if (typeof raw.id !== "string" || !/^[a-f0-9-]{36}$/.test(raw.id)) return null
    return { ...previewGuest, id: raw.id, first_name: input.firstName, last_name: input.lastName, email: input.email,
      marketing_opt_in: input.marketingOptIn, cancelled_at: raw.cancelled_at ? "2026-11-03T00:00:00Z" : null }
  } catch { return null }
}
export async function savePreviewGuest(guest: GuestRegistration) {
  if (!hostedGuestPreview()) throw new Error("Sandbox unavailable")
  ;(await cookies()).set(key, Buffer.from(JSON.stringify(guest)).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400,
  })
}
export async function registerPreviewGuest(input: GuestInput) {
  const previous = await readPreviewGuest()
  const guest = { ...previewGuest, id: previous?.email === input.email && !previous.cancelled_at ? previous.id : randomUUID(),
    event_id: demoEvent.id, first_name: input.firstName, last_name: input.lastName, email: input.email,
    marketing_opt_in: input.marketingOptIn, cancelled_at: null, created_at: new Date().toISOString() }
  await savePreviewGuest(guest)
  return guest
}
