"use client"

import { useState } from "react"
import Link from "next/link"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import { formatEventDateTime, registrationBand } from "@/lib/events/calendar"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  events: EventWithRegistration[]
  totalCount: number
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
      className="relative block aspect-[4/3] min-h-32 overflow-hidden rounded-lg bg-zinc-950 sm:aspect-auto sm:h-full"
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
        className="inline-flex items-center justify-center rounded-lg bg-ipn px-3 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
      >
        Register
      </a>
    )
  }

  return (
    <Link
      href={`/dashboard/events/${event.slug}`}
      className="inline-flex items-center justify-center rounded-lg bg-ipn px-3 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
    >
      {event.is_registered ? "View event" : "Details"}
    </Link>
  )
}

function CompactEventCard({ event }: { event: EventWithRegistration }) {
  const countLabel = registrationBand(event.registration_count)

  return (
    <article className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[210px_1fr]">
      <EventArtwork event={event} />

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
            {event.event_type}
          </span>
          <span className="line-clamp-1 text-xs text-zinc-400">
            {formatEventDateTime(event.starts_at, event.ends_at, event.timezone)}
          </span>
          {countLabel && (
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">
              {countLabel}
            </span>
          )}
        </div>

        <Link href={`/dashboard/events/${event.slug}`} className="group mt-2">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn">
            {event.title}
          </h3>
        </Link>

        {event.summary && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
            {event.summary}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <EventCta event={event} />
          <AddToCalendarButton event={event} compact />
        </div>
      </div>
    </article>
  )
}

export default function UpcomingEventsCarousel({ events, totalCount }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const activeEvent = events[activeIndex]
  const hasMultiple = events.length > 1
  const countLabel = `${totalCount} upcoming event${totalCount === 1 ? "" : "s"}`

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
    <section className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-ipn">Upcoming Events</p>
            <span className="rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn">
              {countLabel}
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">
            What&apos;s coming up at IPN
          </h2>
        </div>
        <Link
          href="/dashboard/events"
          className="text-sm font-medium text-ipn hover:underline"
        >
          View all events
        </Link>
      </div>

      {activeEvent ? (
        <>
          <div
            className="mt-4"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            <CompactEventCard key={activeEvent.id} event={activeEvent} />
          </div>

          {hasMultiple && (
            <div className="mt-auto pt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {events.slice(0, 4).map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                      index === activeIndex
                        ? "border-ipn/30 bg-ipn-light"
                        : "border-zinc-200 bg-zinc-50 hover:border-ipn/20"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        index === activeIndex ? "bg-ipn" : "bg-zinc-300"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-zinc-800">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                        {formatEventDateTime(event.starts_at, event.ends_at, event.timezone)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-500">
                    Event {activeIndex + 1} of {events.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {events.map((event, index) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => goTo(index)}
                        className={`h-2.5 rounded-full transition ${
                          index === activeIndex
                            ? "w-7 bg-ipn"
                            : "w-2.5 bg-zinc-200 hover:bg-zinc-300"
                        }`}
                        aria-label={`Show event ${index + 1}`}
                        aria-current={index === activeIndex ? "true" : undefined}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(activeIndex - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                  aria-label="Previous event"
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(activeIndex + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                  aria-label="Next event"
                >
                  <ArrowIcon direction="right" />
                </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
          <h3 className="text-base font-semibold text-zinc-900">
            New events are coming soon
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            When IPN Labs, PsychedelX, or community events are published, they
            will appear here first.
          </p>
        </div>
      )}
    </section>
  )
}
