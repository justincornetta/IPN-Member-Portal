"use client"

import { useState } from "react"
import Link from "next/link"
import EventCard from "@/components/events/EventCard"
import { formatEventDateTime } from "@/lib/events/calendar"
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

export default function UpcomingEventsCarousel({ events, totalCount }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const activeEvent = events[activeIndex]
  const hasMultiple = events.length > 1

  function goTo(index: number) {
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
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ipn">Upcoming Events</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">
            What&apos;s coming up at IPN
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Register for upcoming programming, add events to your calendar, and
            jump into event chats when they are available.
          </p>
        </div>
        <Link
          href="/dashboard/events"
          className="inline-flex w-fit items-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          View all events
        </Link>
      </div>

      {activeEvent ? (
        <>
          <div
            className="mt-5"
            onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            <EventCard key={activeEvent.id} event={activeEvent} />
          </div>

          {hasMultiple && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex - 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Previous event"
                  >
                    <ArrowIcon direction="left" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(activeIndex + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
                    aria-label="Next event"
                  >
                    <ArrowIcon direction="right" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {events.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`rounded-lg border p-3 text-left transition ${
                      index === activeIndex
                        ? "border-ipn/30 bg-ipn/5"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="line-clamp-1 text-xs font-medium text-zinc-900">
                      {event.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-zinc-400">
                      {formatEventDateTime(event.starts_at, null, event.timezone)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {totalCount > events.length && (
            <p className="mt-4 text-xs text-zinc-400">
              Showing {events.length} of {totalCount} upcoming events.
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
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
