"use client"

import Link from "next/link"
import { MapPinIcon } from "@heroicons/react/24/outline"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import { meetupDisplayDetails } from "@/lib/conferences/meetup-display"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  events: EventWithRegistration[]
  conferences: ConferenceRecord[]
  totalCount: number
  registeredMeetupIds?: string[]
  className?: string
}

type DashboardActivity =
  | { kind: "event"; event: EventWithRegistration }
  | {
      kind: "community"
      conference: ConferenceRecord
      meetup: ConferenceRecord["meetups"][number]
      isRegistered: boolean
    }

function ActivityCard({ activity }: { activity: DashboardActivity }) {
  const isCommunity = activity.kind === "community"
  const href = isCommunity
    ? `/dashboard/conferences/${activity.conference.slug}#ipn-meetups`
    : `/dashboard/events/${activity.event.slug}`
  const title = isCommunity ? activity.meetup.title : activity.event.title
  const imageUrl = isCommunity
    ? "/events/horizons-community-meetup.png"
    : activity.event.thumbnail_url
  const label = isCommunity ? "Community" : activity.event.event_type
  const location = isCommunity
    ? activity.meetup.location || activity.conference.venue
    : activity.event.location_label
  const schedule = activity.kind === "community"
    ? meetupDisplayDetails(activity.meetup, activity.conference)
    : {
        startsAt: activity.event.starts_at,
        endsAt: activity.event.ends_at,
        timezone: activity.event.timezone,
        description: activity.event.summary ?? activity.event.description,
      }
  const isRegistered = isCommunity
    ? activity.isRegistered
    : activity.event.is_registered
  const calendarEvent = isCommunity
    ? {
        id: `community-${activity.conference.id}-${activity.meetup.id}`,
        title,
        starts_at: schedule.startsAt,
        ends_at: schedule.endsAt,
        timezone: schedule.timezone,
        summary: schedule.description,
        description: schedule.description,
        join_url: null,
        location_label: location,
        location_details: null,
      }
    : activity.event

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <Link
        href={href}
        className="relative block aspect-video overflow-hidden bg-ipn-light"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl || "/purple_icon.png"}
          alt=""
          className={`h-full w-full ${imageUrl ? "object-cover" : "object-contain p-12"}`}
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href} className="group">
          <h3 className="text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn sm:text-lg">
            {title}
          </h3>
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500">
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
              isCommunity
                ? "bg-[#E4F6F1] text-[#176B5B]"
                : "bg-ipn-light text-ipn"
            }`}
          >
            {label}
          </span>
          <EventDateTime
            startsAt={schedule.startsAt}
            endsAt={schedule.endsAt}
            timezone={schedule.timezone}
          />
        </div>

        {location && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <MapPinIcon className="h-4 w-4 flex-none" aria-hidden="true" />
            <span>{location}</span>
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={`inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold ${
              isRegistered
                ? "bg-[#E4F6F1] text-[#176B5B]"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isRegistered ? "You’re registered" : "Not registered"}
          </span>

          <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
            <AddToCalendarButton event={calendarEvent} compact />
            <Link
              href={href}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-semibold text-white transition hover:bg-ipn-dark sm:min-h-0"
            >
              View event
              <span aria-hidden="true" className="ml-3 text-lg leading-none">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function UpcomingEventsCarousel({
  events,
  conferences = [],
  totalCount,
  registeredMeetupIds = [],
  className = "",
}: Props) {
  const communityActivity = conferences
    .flatMap((conference) =>
      conference.meetups.map((meetup) => ({ conference, meetup })),
    )
    .sort((a, b) => a.meetup.startsAt.localeCompare(b.meetup.startsAt))[0]

  const activities: DashboardActivity[] = []
  if (events[0]) activities.push({ kind: "event", event: events[0] })
  if (communityActivity) {
    activities.push({
      kind: "community",
      ...communityActivity,
      isRegistered: registeredMeetupIds.includes(communityActivity.meetup.id),
    })
  }
  if (!communityActivity && events[1]) {
    activities.push({ kind: "event", event: events[1] })
  }

  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
      aria-labelledby="upcoming-events-at-ipn"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="upcoming-events-at-ipn"
          className="text-lg font-semibold text-zinc-900 sm:text-xl"
        >
          Upcoming Events at IPN
        </h2>
        <Link
          href="/dashboard/events"
          aria-label={`View all ${totalCount + (communityActivity ? 1 : 0)} upcoming events`}
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-ipn hover:underline sm:min-h-0 sm:text-sm"
        >
          <span className="sm:hidden">View all</span>
          <span className="hidden sm:inline">View all events</span>
          <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>

      {activities.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {activities.map((activity) => (
            <ActivityCard
              key={
                activity.kind === "event"
                  ? `event:${activity.event.id}`
                  : `community:${activity.conference.id}:${activity.meetup.id}`
              }
              activity={activity}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
          <h3 className="font-semibold text-zinc-900">New events are coming soon</h3>
          <p className="mt-2 text-sm text-zinc-500">
            IPN Labs and community meetups will appear here when they are announced.
          </p>
        </div>
      )}
    </section>
  )
}
