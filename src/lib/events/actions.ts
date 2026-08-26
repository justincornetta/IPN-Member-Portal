"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { markOnboardingStepsComplete } from "@/lib/onboarding/progress"
import { recordPortalAnalyticsEvent } from "@/lib/portal-analytics/events"
import { sendEventRsvpSlackNotification } from "@/lib/slack/event-rsvp"
import { sendEventRegistrationConfirmation } from "./email-service"

type EventRegistrationResult = {
  error?: string
  eventChatAvailable?: boolean
}

type AnalyticsContext = {
  sessionId?: string
  anonymousId?: string
  pagePath?: string
  pageTitle?: string
  referrer?: string
}

export async function registerForEvent(
  eventId: string,
  eventSlug: string,
  analytics?: AnalyticsContext,
): Promise<EventRegistrationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You need to be logged in to RSVP." }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, chat_platform, chat_external_url, chat_status")
    .eq("id", eventId)
    .eq("status", "published")
    .single()

  if (eventError || !event) return { error: "This event is not available." }

  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: eventId, user_id: user.id })

  const isNewRsvp = !error
  if (error && error.code !== "23505") return { error: error.message }

  await markOnboardingStepsComplete(supabase, user.id, ["event_rsvp"])
  await sendEventRegistrationConfirmation(eventId, user.id)
  if (isNewRsvp) {
    after(() => sendEventRsvpSlackNotification({
      kind: "event",
      eventId,
      userId: user.id,
    }))
  }
  if (analytics?.sessionId) {
    await recordPortalAnalyticsEvent({
      eventName: "event_rsvp_created",
      sessionId: analytics.sessionId,
      anonymousId: analytics.anonymousId,
      pagePath: analytics.pagePath,
      pageTitle: analytics.pageTitle,
      referrer: analytics.referrer,
      userId: user.id,
      metadata: { eventId, eventSlug },
    })
  }
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  revalidatePath(`/dashboard/events/${eventSlug}`)

  return {
    eventChatAvailable: event.chat_platform === "whatsapp"
      && event.chat_status === "active"
      && Boolean(event.chat_external_url),
  }
}

export async function unregisterFromEvent(
  eventId: string,
  eventSlug: string,
  analytics?: AnalyticsContext,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  if (analytics?.sessionId) {
    await recordPortalAnalyticsEvent({
      eventName: "event_rsvp_cancelled",
      sessionId: analytics.sessionId,
      anonymousId: analytics.anonymousId,
      pagePath: analytics.pagePath,
      pageTitle: analytics.pageTitle,
      referrer: analytics.referrer,
      userId: user.id,
      metadata: { eventId, eventSlug },
    })
  }
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  revalidatePath(`/dashboard/events/${eventSlug}`)

  return {}
}
