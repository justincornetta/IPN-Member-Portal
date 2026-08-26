"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import { registrationBand } from "@/lib/events/calendar"
import type { ConferenceMeetup, ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  events: EventWithRegistration[]
  conferences: ConferenceRecord[]
  totalCount: number
  className?: string
}

type HomepageTab = "events" | "conferences"
type MeetupWithConference = {
  meetup: ConferenceMeetup
  conference: ConferenceRecord
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
        />
      )}
    </svg>
  )
}

function EventArtwork({ event }: { event: EventWithRegistration }) {
  return (
    <Link
      href={`/dashboard/events/${event.slug}`}
      data-analytics-event="curated_click"
      data-analytics-id={`dashboard-event-artwork-${event.slug}`}
      data-analytics-label="Dashboard event artwork"
      className="relative block aspect-video w-full overflow-hidden rounded-lg bg-zinc-950"
    >
      {event.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.thumbnail_url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#a78bfa_0,#664fa1_35%,#18181b_75%)]" />
      )}
      <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800">
        {event.event_type}
      </span>
    </Link>
  )
}

function EventCta({ event }: { event: EventWithRegistration }) {
  if (event.registration_url && event.requires_verified_ticket && !event.has_verified_ticket) {
    return (
      <a
        href={event.registration_url}
        target="_blank"
        rel="noreferrer"
        data-analytics-event="curated_click"
        data-analytics-id={`dashboard-eventbrite-registration-${event.slug}`}
        data-analytics-label="Dashboard Eventbrite registration"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-3 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
      >
        Register
      </a>
    )
  }

  return (
    <Link
      href={`/dashboard/events/${event.slug}`}
      data-analytics-event="curated_click"
      data-analytics-id={`dashboard-event-cta-${event.slug}`}
      data-analytics-label="Dashboard event CTA"
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-3 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
    >
      {event.is_registered ? "View event" : "Details"}
    </Link>
  )
}

function CompactEventCard({
  event,
  hasMultiple,
  onPrevious,
  onNext,
}: {
  event: EventWithRegistration
  hasMultiple: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  const countLabel = registrationBand(event.registration_count)

  return (
    <article className="grid w-full gap-3 sm:grid-cols-[minmax(12rem,15rem)_1fr] sm:gap-4">
      <EventArtwork event={event} />

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
            {event.event_type}
          </span>
          <span className="line-clamp-1 text-xs text-zinc-400">
            <EventDateTime
              startsAt={event.starts_at}
              endsAt={event.ends_at}
              timezone={event.timezone}
            />
          </span>
          {countLabel && (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">
              {countLabel}
            </span>
          )}
        </div>

        <Link
          href={`/dashboard/events/${event.slug}`}
          data-analytics-event="curated_click"
          data-analytics-id={`dashboard-event-title-${event.slug}`}
          data-analytics-label="Dashboard event title"
          className="group mt-2"
        >
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn">
            {event.title}
          </h3>
        </Link>

        {event.summary && (
          <p className="mt-2 line-clamp-1 text-sm leading-5 text-zinc-500 sm:leading-6">
            {event.summary}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3 sm:pt-4">
          <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none sm:flex-wrap sm:items-center">
            <EventCta event={event} />
            <AddToCalendarButton event={event} compact />
          </div>
          {hasMultiple && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevious}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                aria-label="Previous IPN event"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                aria-label="Next IPN event"
              >
                <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function MeetupStrip({ item }: { item: MeetupWithConference | null }) {
  if (!item) {
    return (
      <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">IPN Meetups</p>
          <p className="mt-1 text-sm font-medium text-zinc-700">No IPN meetup announced yet</p>
        </div>
        <Link
          href="/dashboard/conferences"
          className="inline-flex min-h-11 items-center text-sm font-medium text-ipn hover:underline sm:min-h-0"
        >
          Browse conferences
        </Link>
      </div>
    )
  }

  const { meetup, conference } = item
  const meetupDate = new Date(meetup.startsAt)
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(meetupDate)
  const day = new Intl.DateTimeFormat("en", { day: "numeric" }).format(meetupDate)

  return (
    <article className="grid gap-3 border-t border-zinc-200 pt-3 sm:grid-cols-[3.75rem_1fr_auto] sm:items-center">
      <div className="hidden aspect-video items-center justify-center rounded-md bg-[#F1FBF8] text-center text-[#176B5B] sm:flex sm:aspect-auto sm:h-12">
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-wide">{month}</span>
          <span className="block text-base font-semibold leading-none">{day}</span>
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-full bg-[#E4F6F1] px-2 py-1 font-semibold text-[#176B5B]">IPN Meetup</span>
          <span className="line-clamp-1">At {conference.name}</span>
          {meetup.location && <span className="line-clamp-1">· {meetup.location}</span>}
        </div>
        <Link
          href={`/dashboard/conferences/${conference.slug}`}
          className="mt-1 block truncate text-sm font-semibold text-zinc-900 hover:text-ipn"
        >
          {meetup.title}
        </Link>
      </div>
      <Link
        href={`/dashboard/conferences/${conference.slug}`}
        data-analytics-event="curated_click"
        data-analytics-id={`dashboard-meetup-${meetup.id}`}
        data-analytics-label="RSVP to IPN meetup"
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#9DDCCE] bg-white px-3 py-2 text-sm font-semibold text-[#176B5B] transition hover:bg-[#F1FBF8] sm:min-h-0"
      >
        RSVP to meetup
      </Link>
    </article>
  )
}

function ConferencePreview({ conference }: { conference: ConferenceRecord | undefined }) {
  if (!conference) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-5 text-center">
        <h3 className="text-base font-semibold text-zinc-900">No upcoming conferences</h3>
        <p className="mt-2 text-sm text-zinc-500">New conference opportunities will appear here when they are announced.</p>
      </div>
    )
  }

  const meetupCount = conference.meetups.length
  const location = [conference.city, conference.state ?? conference.country].filter(Boolean).join(", ")

  return (
    <article className="flex min-h-60 flex-col rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-semibold text-ipn">{conference.category}</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${meetupCount ? "bg-[#E4F6F1] text-[#176B5B]" : "bg-zinc-100 text-zinc-500"}`}>
          {meetupCount ? `${meetupCount} IPN meetup${meetupCount === 1 ? "" : "s"}` : "No IPN meetup announced"}
        </span>
      </div>
      <Link href={`/dashboard/conferences/${conference.slug}`} className="mt-3 group">
        <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-ipn">{conference.name}</h3>
      </Link>
      <p className="mt-2 text-sm text-zinc-500">
        <EventDateTime startsAt={conference.starts_at} endsAt={conference.ends_at} timezone={conference.timezone} />
        {location ? ` · ${location}` : ""}
      </p>
      {conference.summary && <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500">{conference.summary}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Link
          href={`/dashboard/conferences/${conference.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
        >
          View conference
        </Link>
        <Link href="/dashboard/conferences" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-ipn hover:underline sm:min-h-0">
          View all conferences
        </Link>
      </div>
    </article>
  )
}

export default function UpcomingEventsCarousel({ events, conferences = [], totalCount, className = "" }: Props) {
  const [activeTab, setActiveTab] = useState<HomepageTab>("events")
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const activeEvent = events[activeIndex]
  const hasMultiple = events.length > 1
  const countLabel = `${totalCount} upcoming event${totalCount === 1 ? "" : "s"}`
  const meetupItems = useMemo<MeetupWithConference[]>(
    () => conferences
      .flatMap((conference) => conference.meetups.map((meetup) => ({ conference, meetup })))
      .sort((a, b) => a.meetup.startsAt.localeCompare(b.meetup.startsAt)),
    [conferences],
  )
  const featuredMeetup = meetupItems[0] ?? null

  function goTo(index: number) {
    if (!events.length) return
    setActiveIndex((index + events.length) % events.length)
  }

  function handleTouchEnd(x: number) {
    if (touchStartX === null || !hasMultiple) return

    const distance = touchStartX - x
    if (Math.abs(distance) > 40) {
      goTo(activeIndex + (distance > 0 ? 1 : -1))
    }
    setTouchStartX(null)
  }

  return (
    <section className={`flex flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-xl sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            What&apos;s coming up at IPN
          </h2>
        </div>
        <Link
          href={activeTab === "events" ? "/dashboard/events" : "/dashboard/conferences"}
          data-analytics-event="curated_click"
          data-analytics-id="dashboard-view-all-events"
          data-analytics-label={activeTab === "events" ? "View all events" : "View all conferences"}
          className="inline-flex min-h-11 items-center text-sm font-medium text-ipn hover:underline sm:min-h-0"
        >
          View all {activeTab === "events" ? "events" : "conferences"}
        </Link>
      </div>

      <div className="mt-3 inline-flex w-fit max-w-full rounded-lg border border-zinc-200 bg-zinc-50 p-1" role="tablist" aria-label="Upcoming IPN activity">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "events"}
          onClick={() => setActiveTab("events")}
          className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition ${activeTab === "events" ? "bg-white text-ipn shadow-sm ring-1 ring-ipn/20" : "text-zinc-500 hover:text-zinc-900"}`}
        >
          IPN Events <span className="ml-1 text-xs text-zinc-400">{countLabel}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "conferences"}
          onClick={() => setActiveTab("conferences")}
          className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition ${activeTab === "conferences" ? "bg-white text-ipn shadow-sm ring-1 ring-ipn/20" : "text-zinc-500 hover:text-zinc-900"}`}
        >
          Conferences
          {meetupItems.length > 0 && (
            <span className="ml-2 rounded-full bg-[#E4F6F1] px-2 py-0.5 text-[11px] font-semibold text-[#176B5B]">
              {meetupItems.length} meetup{meetupItems.length === 1 ? "" : "s"}
            </span>
          )}
        </button>
      </div>

      {activeTab === "events" && activeEvent ? (
        <>
          <div
            className="mt-3 flex flex-1 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:mt-4"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            <CompactEventCard
              key={activeEvent.id}
              event={activeEvent}
              hasMultiple={hasMultiple}
              onPrevious={() => goTo(activeIndex - 1)}
              onNext={() => goTo(activeIndex + 1)}
            />
            <MeetupStrip item={featuredMeetup} />
          </div>
        </>
      ) : activeTab === "events" ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
          <h3 className="text-base font-semibold text-zinc-900">
            New events are coming soon
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            When IPN Labs, PsychedelX, or community events are published, they
            will appear here first.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 sm:mt-4">
          <ConferencePreview conference={conferences[0]} />
        </div>
      )}
    </section>
  )
}
