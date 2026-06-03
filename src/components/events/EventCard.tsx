"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { registerForEvent } from "@/lib/events/actions"
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  canJoinEvent,
  formatEventDateTime,
  joinWindowMessage,
  registrationBand,
} from "@/lib/events/calendar"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  event: EventWithRegistration
  variant?: "compact" | "full"
}

function EventArtwork({ event }: { event: EventWithRegistration }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-lg bg-zinc-950 sm:h-full sm:min-h-40">
      {event.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.thumbnail_url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0,#664fa1_24%,#18181b_68%)]">
          <div className="absolute left-6 top-6 h-2 w-2 rounded-full bg-white/80" />
          <div className="absolute left-16 top-16 h-1.5 w-1.5 rounded-full bg-white/70" />
          <div className="absolute bottom-8 left-10 h-2.5 w-2.5 rounded-full bg-white/70" />
          <div className="absolute right-10 top-10 h-2 w-2 rounded-full bg-white/80" />
          <div className="absolute bottom-12 right-14 h-1.5 w-1.5 rounded-full bg-white/60" />
          <div className="absolute left-7 top-7 h-px w-24 rotate-45 bg-white/25" />
          <div className="absolute bottom-10 left-12 h-px w-36 -rotate-12 bg-white/20" />
          <div className="absolute right-12 top-12 h-px w-28 rotate-[135deg] bg-white/25" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800">
          {event.event_type}
        </span>
      </div>
    </div>
  )
}

function CalendarActions({ event }: { event: EventWithRegistration }) {
  function downloadIcs() {
    const blob = new Blob([buildIcsContent(event)], {
      type: "text/calendar;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${event.slug}.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={buildGoogleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        Google
      </a>
      <button
        type="button"
        onClick={downloadIcs}
        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        Apple
      </button>
      <button
        type="button"
        onClick={downloadIcs}
        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        Outlook
      </button>
    </div>
  )
}

function ConfirmationModal({
  event,
  onClose,
}: {
  event: EventWithRegistration
  onClose: () => void
}) {
  const hasActiveChat = event.chat_status === "active"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ipn-light text-ipn">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">RSVP confirmed</h2>
            <p className="mt-1 text-sm text-zinc-500">{event.title}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {formatEventDateTime(event.starts_at, event.ends_at, event.timezone)}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-sm text-zinc-700">
            The event opens 15 minutes before the scheduled start time. You can
            join from the link in your email or through the IPN member portal.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">Event chat</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {hasActiveChat
                  ? "Your RSVP unlocks the event chat on the event detail page."
                  : "Join a group chat specific to this event to discuss with other registered IPN members before and after the session."}
              </p>
            </div>
            {hasActiveChat ? (
              <Link
                href={`/dashboard/events/${event.slug}`}
                className="flex-shrink-0 rounded-md border border-ipn/20 bg-white px-2 py-1 text-[11px] font-medium text-ipn transition hover:bg-white/80"
              >
                Open
              </Link>
            ) : (
              <span className="flex-shrink-0 rounded-md border border-ipn/20 bg-white px-2 py-1 text-[11px] font-medium text-ipn">
                Coming soon
              </span>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Add to calendar
          </p>
          <CalendarActions event={event} />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function NoticeModal({
  title,
  message,
  onClose,
}: {
  title: string
  message: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">{message}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EventCard({ event, variant = "full" }: Props) {
  const [registered, setRegistered] = useState(event.is_registered)
  const [count, setCount] = useState(event.registration_count)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const countLabel = registrationBand(count)
  const isCompact = variant === "compact"
  const hasActiveChat = event.chat_status === "active"

  function handleRegister() {
    setError(null)
    startTransition(async () => {
      const result = await registerForEvent(event.id, event.slug)
      if (result.error) {
        setError(result.error)
        return
      }

      if (!registered) setCount((current) => current + 1)
      setRegistered(true)
      setConfirmOpen(true)
    })
  }

  function handleJoin() {
    if (!event.join_url) {
      setNotice({
        title: "Join link unavailable",
        message: "The join link has not been added for this event yet.",
      })
      return
    }

    if (!canJoinEvent(event.starts_at)) {
      setNotice({
        title: "Event has not started",
        message: joinWindowMessage(event.starts_at, event.timezone),
      })
      return
    }

    window.open(event.join_url, "_blank", "noopener,noreferrer")
  }

  return (
    <article className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm ${isCompact ? "" : "sm:p-4"}`}>
      <div className={`grid gap-4 ${isCompact ? "" : "sm:grid-cols-[220px_1fr]"}`}>
        <EventArtwork event={event} />

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
              {event.event_type}
            </span>
            <span className="text-xs text-zinc-400">
              {formatEventDateTime(event.starts_at, event.ends_at, event.timezone)}
            </span>
          </div>

          <Link href={`/dashboard/events/${event.slug}`} className="mt-2 group">
            <h2 className="text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn">
              {event.title}
            </h2>
          </Link>

          {event.summary && (
            <p className={`mt-2 text-sm leading-6 text-zinc-500 ${isCompact ? "max-h-12 overflow-hidden" : ""}`}>
              {event.summary}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
            {event.location_label && (
              <span>
                <span className="font-medium text-zinc-500">Location:</span>{" "}
                {event.location_label}
              </span>
            )}
            {event.speakers && (
              <span>
                <span className="font-medium text-zinc-500">Speakers:</span>{" "}
                {event.speakers}
              </span>
            )}
          </div>

          <div className="mt-auto pt-4">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            {!registered ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-h-8 text-xs font-medium text-zinc-400">
                  {countLabel}
                </div>
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={pending}
                  className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Saving..." : "RSVP"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {countLabel && (
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600">
                      {countLabel}
                    </span>
                  )}
                  {hasActiveChat ? (
                    <Link
                      href={`/dashboard/events/${event.slug}`}
                      className="rounded-md border border-ipn/20 bg-ipn-light px-2.5 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn-light/70"
                    >
                      Event chat
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-md border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-400"
                    >
                      Event chat coming soon
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleJoin}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
                >
                  Join
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmationModal event={event} onClose={() => setConfirmOpen(false)} />
      )}
      {notice && (
        <NoticeModal
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </article>
  )
}
