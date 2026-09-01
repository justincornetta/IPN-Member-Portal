import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

const WEBHOOK_TIMEOUT_MS = 10000

export type EventRsvpNotification =
  | {
      kind: "event"
      eventId: string
      userId: string
    }
  | {
      kind: "conference"
      conferenceId: string
      userId: string
    }
  | {
      kind: "meetup"
      conferenceId: string
      meetupId: string
      userId: string
    }

type NotificationDetails = {
  eventName: string
  rsvpType: string
  parentConference: string | null
  detail: string | null
  rsvpCount: number
}

type ConferenceMeetup = {
  id: string
  title: string
  type?: string | null
}

type ConferenceDiscount = {
  label?: string | null
}

function escapeSlackText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return "Not provided"

  return trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function field(label: string, value: string) {
  return {
    type: "mrkdwn" as const,
    text: `*${label}:*\n${escapeSlackText(value)}`,
    verbatim: true,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseMeetups(value: unknown): ConferenceMeetup[] {
  return Array.isArray(value)
    ? value.filter((item): item is ConferenceMeetup => (
        typeof item === "object" &&
        item !== null &&
        typeof (item as ConferenceMeetup).id === "string" &&
        typeof (item as ConferenceMeetup).title === "string"
      ))
    : []
}

function parseDiscounts(value: unknown): ConferenceDiscount[] {
  return Array.isArray(value)
    ? value.filter((item): item is ConferenceDiscount => (
        typeof item === "object" && item !== null
      ))
    : []
}

async function getNotificationDetails(
  notification: EventRsvpNotification,
): Promise<NotificationDetails> {
  const admin = createAdminClient()

  if (notification.kind === "event") {
    const [{ data: event, error: eventError }, { count, error: countError }] = await Promise.all([
      admin
        .from("events")
        .select("title, event_type")
        .eq("id", notification.eventId)
        .single(),
      admin
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", notification.eventId),
    ])

    if (eventError || !event) throw new Error(eventError?.message ?? "Event not found")
    if (countError) throw new Error(countError.message)

    return {
      eventName: event.title,
      rsvpType: event.event_type || "IPN Event",
      parentConference: null,
      detail: null,
      rsvpCount: count ?? 0,
    }
  }

  const { data: conference, error: conferenceError } = await admin
    .from("conferences")
    .select("name, category, meetups, discounts")
    .eq("id", notification.conferenceId)
    .single()

  if (conferenceError || !conference) {
    throw new Error(conferenceError?.message ?? "Conference not found")
  }

  if (notification.kind === "conference") {
    const { count, error: countError } = await admin
      .from("conference_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("conference_id", notification.conferenceId)

    if (countError) throw new Error(countError.message)

    const hasMemberDiscount = parseDiscounts(conference.discounts).length > 0
    return {
      eventName: conference.name,
      rsvpType: "Conference",
      parentConference: null,
      detail: [
        conference.category,
        hasMemberDiscount ? "Member discount available" : null,
      ].filter(Boolean).join(" · "),
      rsvpCount: count ?? 0,
    }
  }

  const meetup = parseMeetups(conference.meetups)
    .find((item) => item.id === notification.meetupId)
  if (!meetup) throw new Error("Meetup not found")

  const { count, error: countError } = await admin
    .from("conference_meetup_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("conference_id", notification.conferenceId)
    .eq("meetup_id", notification.meetupId)

  if (countError) throw new Error(countError.message)

  return {
    eventName: meetup.title,
    rsvpType: meetup.type || "IPN Meetup",
    parentConference: conference.name,
    detail: "Conference meetup",
    rsvpCount: count ?? 0,
  }
}

async function postToSlack(webhookUrl: string, body: unknown): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Slack returned ${response.status} ${response.statusText}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendEventRsvpSlackNotification(
  notification: EventRsvpNotification,
): Promise<void> {
  const webhookUrl = process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    const admin = createAdminClient()
    const [{ data: profile, error: profileError }, details] = await Promise.all([
      admin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", notification.userId)
        .single(),
      getNotificationDetails(notification),
    ])

    if (profileError || !profile) {
      throw new Error(profileError?.message ?? "Member profile not found")
    }

    let email = profile.email
    if (!email) {
      const { data, error } = await admin.auth.admin.getUserById(notification.userId)
      if (error) throw new Error(error.message)
      email = data.user.email ?? null
    }

    const fullName = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ")

    const notificationLabel = notification.kind === "meetup"
      ? "New IPN meetup RSVP"
      : notification.kind === "conference"
        ? "New conference RSVP"
        : "New event RSVP"

    const payloadFields = [
      field("RSVP type", details.rsvpType),
      field("Event", details.eventName),
      details.parentConference ? field("Conference", details.parentConference) : null,
      details.detail ? field("Notification detail", details.detail) : null,
      field("Member", fullName),
      field("Email", email ?? ""),
      field("Cumulative RSVPs", String(details.rsvpCount)),
    ].filter((item): item is ReturnType<typeof field> => Boolean(item))

    const payload = {
      text: `${notificationLabel}: ${details.eventName} — ${fullName || email || "Member"}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: notificationLabel,
          },
        },
        {
          type: "section",
          fields: payloadFields,
        },
      ],
    }

    await postToSlack(webhookUrl, payload)
  } catch (error: unknown) {
    console.error("Event RSVP Slack notification failed", errorMessage(error))
  }
}
