"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEventRsvpSlackNotification } from "@/lib/slack/event-rsvp"

export async function rsvpToConference(
  conferenceId: string,
  conferenceSlug: string,
  isVisible: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You need to be logged in to RSVP." }

  const { data: conference } = await supabase
    .from("conferences")
    .select("id")
    .eq("id", conferenceId)
    .eq("status", "published")
    .single()

  if (!conference) return { error: "This conference is not available." }

  const { error } = await supabase
    .from("conference_rsvps")
    .insert({ conference_id: conferenceId, user_id: user.id, is_visible: isVisible })

  const isNewRsvp = !error
  if (error?.code === "23505") {
    const { error: updateError } = await supabase
      .from("conference_rsvps")
      .update({ is_visible: isVisible })
      .eq("conference_id", conferenceId)
      .eq("user_id", user.id)

    if (updateError) return { error: updateError.message }
  } else if (error) {
    return { error: error.message }
  }

  if (isNewRsvp) {
    after(() => sendEventRsvpSlackNotification({
      kind: "conference",
      conferenceId,
      userId: user.id,
    }))
  }

  revalidatePath(`/dashboard/conferences/${conferenceSlug}`)
  revalidatePath("/dashboard/conferences")
  return {}
}

export async function cancelConferenceRsvp(
  conferenceId: string,
  conferenceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("conference_rsvps")
    .delete()
    .eq("conference_id", conferenceId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/conferences/${conferenceSlug}`)
  revalidatePath("/dashboard/conferences")
  return {}
}

export async function rsvpToMeetup(
  conferenceId: string,
  meetupId: string,
  conferenceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "You need to be logged in to RSVP." }

  const { error } = await supabase
    .from("conference_meetup_rsvps")
    .insert({ conference_id: conferenceId, meetup_id: meetupId, user_id: user.id })

  const isNewRsvp = !error
  if (error && error.code !== "23505") return { error: error.message }

  if (isNewRsvp) {
    after(() => sendEventRsvpSlackNotification({
      kind: "meetup",
      conferenceId,
      meetupId,
      userId: user.id,
    }))
  }

  revalidatePath(`/dashboard/conferences/${conferenceSlug}`)
  return {}
}

export async function cancelMeetupRsvp(
  conferenceId: string,
  meetupId: string,
  conferenceSlug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("conference_meetup_rsvps")
    .delete()
    .eq("conference_id", conferenceId)
    .eq("meetup_id", meetupId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/conferences/${conferenceSlug}`)
  return {}
}

export async function updateConferenceRsvpVisibility(
  conferenceId: string,
  conferenceSlug: string,
  isVisible: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("conference_rsvps")
    .update({ is_visible: isVisible })
    .eq("conference_id", conferenceId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/conferences/${conferenceSlug}`)
  return {}
}
