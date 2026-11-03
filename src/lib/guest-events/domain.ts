import type { EventRecord } from "../events/types"

export type GuestInput = { firstName: string; lastName: string; email: string; marketingOptIn: boolean }
export type GuestEmailKind = "rsvp_confirmation" | "reminder_24h" | "reminder_1h" | "membership_invitation"
export type GuestRegistration = {
  id: string; event_id: string; first_name: string; last_name: string; email: string
  marketing_opt_in: boolean; cancelled_at: string | null; converted_user_id: string | null
  created_at: string
}
export function parseGuestInput(input: unknown): GuestInput {
  if (!input || typeof input !== "object") throw new Error("Please enter your name and email.")
  const value = input as Record<string, unknown>
  const firstName = typeof value.firstName === "string" ? value.firstName.trim() : ""
  const lastName = typeof value.lastName === "string" ? value.lastName.trim() : ""
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 || /[\r\n<>]/.test(firstName + lastName))
    throw new Error("Please enter your first and last name (up to 80 characters each).")
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new Error("Please enter a valid email address.")
  if (value.website) throw new Error("We couldn't accept this request. Please try again.")
  return { firstName, lastName, email, marketingOptIn: value.marketingOptIn === true }
}
export function guestRsvpAvailable(event: Pick<EventRecord, "status" | "is_recording" | "requires_verified_ticket" | "registration_url" | "starts_at" | "ends_at" | "guest_rsvp_enabled">, now = Date.now()) {
  return event.guest_rsvp_enabled === true && event.status === "published" && !event.is_recording
    && !event.requires_verified_ticket && !event.registration_url
    && new Date(event.ends_at ?? event.starts_at).getTime() > now
}
export function safeWebUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null } catch { return null }
}
export function emailSchedule(event: Pick<EventRecord, "starts_at" | "ends_at">, optIn: boolean, now = Date.now()) {
  const start = new Date(event.starts_at).getTime()
  const end = new Date(event.ends_at ?? event.starts_at).getTime()
  const jobs: { kind: GuestEmailKind; due_at: string }[] = [{ kind: "rsvp_confirmation", due_at: new Date(now).toISOString() }]
  if (start - 86400000 > now) jobs.push({ kind: "reminder_24h", due_at: new Date(start - 86400000).toISOString() })
  if (start - 3600000 > now) jobs.push({ kind: "reminder_1h", due_at: new Date(start - 3600000).toISOString() })
  if (optIn) jobs.push({ kind: "membership_invitation", due_at: new Date(end + 86400000).toISOString() })
  return jobs
}
