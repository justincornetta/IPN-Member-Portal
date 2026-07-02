"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { markOnboardingStepsComplete } from "@/lib/onboarding/progress"
import { sendEventRegistrationConfirmation } from "./email-service"

type EventRegistrationResult = {
  error?: string
  event?: {
    chat_platform: string | null
    chat_external_url: string | null
    chat_status: string | null
  }
}

export async function registerForEvent(
  eventId: string,
  eventSlug: string,
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
    .upsert(
      { event_id: eventId, user_id: user.id },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    )

  if (error) return { error: error.message }

  await markOnboardingStepsComplete(supabase, user.id, ["event_rsvp"])
  await sendEventRegistrationConfirmation(eventId, user.id)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  revalidatePath(`/dashboard/events/${eventSlug}`)

  return {
    event: {
      chat_platform: event.chat_platform,
      chat_external_url: event.chat_external_url,
      chat_status: event.chat_status,
    },
  }
}

export async function unregisterFromEvent(
  eventId: string,
  eventSlug: string,
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

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  revalidatePath(`/dashboard/events/${eventSlug}`)

  return {}
}
