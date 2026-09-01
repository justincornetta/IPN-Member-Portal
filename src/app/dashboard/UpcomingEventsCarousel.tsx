"use client"

import Link from "next/link"
import { ArrowRightIcon, CheckIcon, MapPinIcon } from "@heroicons/react/24/outline"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import { meetupDisplayDetails } from "@/lib/conferences/meetup-display"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  events: EventWithRegistration[]
  conferences: ConferenceRecord[]
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

function startsAt(activity: DashboardActivity) {
  return activity.kind === "event"
    ? activity.event.starts_at
    : activity.meetup.startsAt
}

function ActivitySpotlight({ activity }: { activity: DashboardActivity }) {
  const isCommunity = activity.kind === "community"
  const isRegistered = isCommunity ? activity.isRegistered : activity.event.is_registered
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
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm lg:grid lg:grid-cols-[13rem_minmax(0,1fr)_12.5rem] lg:items-stretch">
      <Link
        href={href}
        className="relative block aspect-video overflow-hidden bg-ipn-light sm:aspect-[2.1/1] lg:aspect-auto lg:min-h-52"
        aria-label={`View ${title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl || "/purple_icon.png"}
          alt=""
          className={`h-full w-full ${
            imageUrl
              ? `object-cover ${isCommunity ? "object-left" : "object-center"}`
              : "object-contain p-12"
          }`}
        />
      </Link>

      <div className="min-w-0 p-5 lg:flex lg:flex-col lg:justify-center lg:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${
              isCommunity
                ? "bg-[#E4F6F1] text-[#176B5B]"
                : "bg-ipn-light text-ipn"
            }`}
          >
            {label}
          </span>
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
              isRegistered
                ? "bg-[#E4F6F1] text-[#176B5B]"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isRegistered && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {isRegistered ? "You’re registered" : "Not registered"}
          </span>
        </div>
        <Link href={href} className="group mt-3 block">
          <h3 className="text-xl font-semibold leading-tight text-zinc-950 group-hover:text-ipn lg:text-2xl">
            {title}
          </h3>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600">
          <EventDateTime
            startsAt={schedule.startsAt}
            endsAt={schedule.endsAt}
            timezone={schedule.timezone}
          />
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-5 w-5 flex-none" aria-hidden="true" />
              <span>{location}</span>
            </span>
          )}
        </div>
        {schedule.description && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-zinc-600">
            {schedule.description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-100 p-5 lg:justify-center lg:border-l lg:border-t-0">
        <Link
          href={href}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-ipn px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ipn-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
        >
          View event
          <ArrowRightIcon className="ml-4 h-4 w-4" aria-hidden="true" />
        </Link>
        <AddToCalendarButton
          event={calendarEvent}
          appearance="ipn"
          label="Add to calendar"
          className="w-full"
        />
      </div>
    </article>
  )
}

export default function UpcomingEventsCarousel({
  events,
  conferences = [],
  registeredMeetupIds = [],
  className = "",
}: Props) {
  const communityActivity = conferences
    .flatMap((conference) =>
      conference.meetups.map((meetup) => ({ conference, meetup })),
    )
    .sort((a, b) => a.meetup.startsAt.localeCompare(b.meetup.startsAt))[0]

  const candidates: DashboardActivity[] = events.slice(0, 2).map((event) => ({
    kind: "event",
    event,
  }))
  if (communityActivity) {
    candidates.push({
      kind: "community",
      ...communityActivity,
      isRegistered: registeredMeetupIds.includes(communityActivity.meetup.id),
    })
  }
  const nextActivity = candidates.sort((a, b) =>
    startsAt(a).localeCompare(startsAt(b)),
  )[0]

  return (
    <section className={className} aria-labelledby="your-next-event">
      <div className="mb-3">
        <h2 id="your-next-event" className="text-lg font-semibold text-ipn sm:text-xl">
          Your next event
        </h2>
      </div>

      {nextActivity ? (
        <ActivitySpotlight activity={nextActivity} />
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
          <h3 className="font-semibold text-zinc-900">New events are coming soon</h3>
          <p className="mt-2 text-sm text-zinc-500">
            IPN Labs and community meetups will appear here when they are announced.
          </p>
        </div>
      )}
    </section>
  )
}
