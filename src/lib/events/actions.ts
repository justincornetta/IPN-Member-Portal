"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function registerForEvent(
  eventId: string,
  eventSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You need to be logged in to RSVP." }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
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

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  revalidatePath(`/dashboard/events/${eventSlug}`)

  return {}
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
