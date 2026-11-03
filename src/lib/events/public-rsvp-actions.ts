"use server"

import { createClient } from "../supabase/server"
import { readGuestEvent } from "../guest-events/service"
import { memberRsvpAvailable, safeWebUrl } from "../guest-events/domain"
import { buildGoogleCalendarUrl } from "./calendar"
import { registerForEvent } from "./actions"

export type PublicRsvpResult = {
  ok?: boolean
  signedIn?: boolean
  needsSignIn?: boolean
  error?: string
  joinUrl?: string | null
  calendarUrl?: string
}

async function eligibleEvent(slug: string) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,200}$/.test(slug)) return null
  const event = await readGuestEvent(slug)
  return event && memberRsvpAvailable(event) ? event : null
}

// This explicit event action, rather than generic sign-in, carries RSVP intent.
export async function signInAndRsvpForEvent(
  slug: string,
  credentials: { email: string; password: string },
): Promise<PublicRsvpResult> {
  try {
    if (!await eligibleEvent(slug)) return { error: "This event is not accepting RSVPs." }
    const email = typeof credentials?.email === "string" ? credentials.email.trim() : ""
    const password = credentials?.password
    if (!email || email.length > 254 || typeof password !== "string" || !password || password.length > 1024) {
      return { error: "Enter your email and password." }
    }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { error: "Email or password is incorrect, or your email still needs verification. Please try again." }
  } catch {
    return { error: "We couldn’t sign you in. Please try again." }
  }
  // Re-read eligibility after login and verify the session again before writing.
  const result = await rsvpFromEventPage(slug)
  if (result.needsSignIn) return result
  return result.ok ? result : { ...result, signedIn: true, error: "You’re signed in, but we couldn’t save your RSVP. Please try again." }
}

export async function rsvpFromEventPage(slug: string): Promise<PublicRsvpResult> {
  let signedIn = false
  try {
    const event = await eligibleEvent(slug)
    if (!event) return { error: "This event is not accepting RSVPs." }
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { needsSignIn: true, error: "Your session has expired. Sign in again to RSVP." }
    signedIn = true
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_banned").eq("id", user.id).maybeSingle()
    if (profileError || !profile || profile.is_banned) return { signedIn, error: "Your account cannot RSVP right now. Please contact IPN for help." }
    const result = await registerForEvent(event.id, event.slug)
    if (result.error) return { signedIn, error: "We couldn’t save your RSVP. Please try again." }
    return { ok: true, signedIn: true, joinUrl: safeWebUrl(event.join_url), calendarUrl: buildGoogleCalendarUrl(event) }
  } catch {
    return { signedIn, error: "We couldn’t save your RSVP. Please try again." }
  }
}
