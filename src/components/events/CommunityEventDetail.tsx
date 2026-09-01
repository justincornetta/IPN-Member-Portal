"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import WhatsAppHandoffAction from "@/components/whatsapp/WhatsAppHandoffAction"
import {
  cancelMeetupRsvp,
  rsvpToMeetup,
} from "@/lib/conferences/actions"
import { meetupDisplayDetails } from "@/lib/conferences/meetup-display"
import type {
  ConferenceMeetup,
  ConferenceRecord,
} from "@/lib/conferences/types"

export type CommunityActivity = {
  meetup: ConferenceMeetup
  conference: ConferenceRecord
}

export default function CommunityEventDetail({
  item,
  compact = false,
  isRegistered = false,
}: {
  item: CommunityActivity
  compact?: boolean
  isRegistered?: boolean
}) {
  const { meetup, conference } = item
  const router = useRouter()
  const [registered, setRegistered] = useState(isRegistered)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const conferenceHref = `/dashboard/conferences/${conference.slug}`
  const location =
    meetup.location ||
    conference.venue ||
    [conference.city, conference.state ?? conference.country]
      .filter(Boolean)
      .join(", ") ||
    "Location to be announced"
  const isHorizons = conference.name.toLowerCase().includes("horizons")
  const imageUrl = isHorizons
    ? "/events/horizons-community-meetup.png"
    : "/purple_icon.png"
  const display = meetupDisplayDetails(meetup, conference)
  const calendarEvent = {
    id: `community-${conference.id}-${meetup.id}`,
    title: meetup.title,
    starts_at: display.startsAt,
    ends_at: display.endsAt,
    timezone: display.timezone,
    summary: display.description,
    description: display.description,
    join_url: null,
    location_label: location,
    location_details: null,
  }

  function updateRsvp(nextRegistered: boolean) {
    setError(null)
    setRegistered(nextRegistered)
    startTransition(async () => {
      const result = nextRegistered
        ? await rsvpToMeetup(conference.id, meetup.id, conference.slug)
        : await cancelMeetupRsvp(conference.id, meetup.id, conference.slug)

      if (result.error) {
        setRegistered(!nextRegistered)
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
      <div
        className={`grid gap-4 ${
          compact
            ? ""
            : "sm:grid-cols-[220px_1fr]"
        }`}
      >
        <Link
          href={conferenceHref}
          className="relative block h-36 overflow-hidden rounded-lg bg-ipn-light sm:h-full sm:min-h-40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className={`h-full w-full ${isHorizons ? "object-cover" : "object-contain p-12"}`}
          />
        </Link>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#E4F6F1] px-2 py-1 text-[11px] font-semibold text-[#176B5B]">
              Community
            </span>
            <span className="text-xs text-zinc-400">
              <EventDateTime
                startsAt={display.startsAt}
                endsAt={display.endsAt}
                timezone={display.timezone}
              />
            </span>
          </div>

          <Link
            href={conferenceHref}
            data-analytics-event="curated_click"
            data-analytics-id={`community-event-title-${meetup.id}`}
            data-analytics-label="View parent conference"
            className="group mt-2"
          >
            <h2 className="text-base font-semibold leading-snug text-zinc-900 transition group-hover:text-ipn">
              {meetup.title}
            </h2>
          </Link>

          <p
            className={`${compact ? "line-clamp-3" : ""} mt-2 text-sm leading-6 text-zinc-500`}
          >
            {display.description ||
              "Connect with students and early-career psychedelic professionals from across the IPN community. Members and prospective members are welcome."}
          </p>

          <p className="mt-3 text-xs leading-5 text-zinc-400">
            <span className="font-medium text-zinc-500">Location:</span>{" "}
            {location}
          </p>

          <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {registered ? (
                <>
                  <WhatsAppHandoffAction
                    kind="permanent"
                    slug="conferences"
                    source="community-event-card"
                    label="Join chat"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-ipn/20 bg-ipn-light px-2.5 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn-light/70 sm:min-h-0"
                  />
                  <button
                    type="button"
                    onClick={() => updateRsvp(false)}
                    disabled={pending}
                    data-analytics-event="curated_click"
                    data-analytics-id={`community-event-cancel-rsvp-${meetup.id}`}
                    data-analytics-label="Cancel RSVP"
                    className="inline-flex min-h-11 items-center rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
                  >
                    {pending ? "Saving..." : "Cancel RSVP"}
                  </button>
                  <span className="inline-flex min-h-11 items-center rounded-md bg-[#E4F6F1] px-2.5 py-1.5 text-xs font-semibold text-[#176B5B] sm:min-h-0">
                    You’re registered
                  </span>
                </>
              ) : (
                <span className="inline-flex min-h-11 items-center rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 sm:min-h-0">
                  Not registered
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <AddToCalendarButton event={calendarEvent} compact />
              {!registered && (
                <button
                  type="button"
                  onClick={() => updateRsvp(true)}
                  disabled={pending}
                  data-analytics-event="curated_click"
                  data-analytics-id={`community-event-rsvp-${meetup.id}`}
                  data-analytics-label="RSVP"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
                >
                  {pending ? "Saving..." : "RSVP"}
                </button>
              )}
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </article>
  )
}
