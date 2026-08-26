import { NextRequest, NextResponse } from "next/server"
import { sendEventRsvpSlackNotification } from "@/lib/slack/event-rsvp"
import { createAdminClient } from "@/lib/supabase/admin"

type LatestRsvp = {
  kind: "event" | "conference" | "meetup"
  parentId: string
  meetupId?: string
  userId: string
  createdAt: string
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.EVENT_RSVP_TEST_SECRET
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (
    !expectedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const admin = createAdminClient()
  const [eventResult, conferenceResult, meetupResult] = await Promise.all([
    admin
      .from("event_registrations")
      .select("event_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("conference_rsvps")
      .select("conference_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("conference_meetup_rsvps")
      .select("conference_id, meetup_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const queryError = eventResult.error ?? conferenceResult.error ?? meetupResult.error
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const candidates: LatestRsvp[] = []
  if (eventResult.data) {
    candidates.push({
      kind: "event",
      parentId: eventResult.data.event_id,
      userId: eventResult.data.user_id,
      createdAt: eventResult.data.created_at,
    })
  }
  if (conferenceResult.data) {
    candidates.push({
      kind: "conference",
      parentId: conferenceResult.data.conference_id,
      userId: conferenceResult.data.user_id,
      createdAt: conferenceResult.data.created_at,
    })
  }
  if (meetupResult.data) {
    candidates.push({
      kind: "meetup",
      parentId: meetupResult.data.conference_id,
      meetupId: meetupResult.data.meetup_id,
      userId: meetupResult.data.user_id,
      createdAt: meetupResult.data.created_at,
    })
  }

  const latest = candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!latest) {
    return NextResponse.json({ error: "No active RSVP found" }, { status: 404 })
  }

  const sent = await sendEventRsvpSlackNotification(
    latest.kind === "event"
      ? { kind: "event", eventId: latest.parentId, userId: latest.userId }
      : latest.kind === "conference"
        ? { kind: "conference", conferenceId: latest.parentId, userId: latest.userId }
        : {
            kind: "meetup",
            conferenceId: latest.parentId,
            meetupId: latest.meetupId!,
            userId: latest.userId,
          },
  )

  return NextResponse.json({ sent, kind: latest.kind, createdAt: latest.createdAt })
}
