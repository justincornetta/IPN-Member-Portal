"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import { registerForEvent, unregisterFromEvent } from "@/lib/events/actions"
import { canJoinEvent, registrationBand } from "@/lib/events/calendar"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  event: EventWithRegistration
  variant?: "compact" | "full"
}

type EventChatState = Pick<
  EventWithRegistration,
  "chat_platform" | "chat_external_url" | "chat_status"
>

function getEventChatUrl(event: EventChatState) {
  if (!event.chat_external_url) return null
  if (event.chat_status === "archived") return null
  return event.chat_external_url
}

function DateBadge({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt)
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(date)
  const day = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date)

  return (
    <span className="flex h-14 w-14 flex-col items-center justify-center rounded-md bg-ipn text-center text-white shadow-sm">
      <span className="text-[11px] font-semibold uppercase leading-none">{month}</span>
      <span className="mt-1 text-lg font-semibold leading-none">{day}</span>
    </span>
  )
}

function EventArtwork({
  event,
  compact = false,
}: {
  event: EventWithRegistration
  compact?: boolean
}) {
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
      {compact && (
        <div className="absolute left-3 top-3">
          <DateBadge startsAt={event.starts_at} />
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 ${compact ? "hidden sm:block" : ""}`}>
        <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800">
          {event.event_type}
        </span>
      </div>
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
  const eventChatUrl = getEventChatUrl(event)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-3 sm:items-center sm:px-4">
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-lg"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
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
              <EventDateTime
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                timezone={event.timezone}
              />
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-sm text-zinc-700">
            Return to the IPN member portal on the day of the event to join. In
            the meantime, join the event-specific WhatsApp chat to connect with
            other registered members before and after the event.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                IPN Event-Specific WhatsApp Chat
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {eventChatUrl
                  ? "Use this chat to ask questions, connect, and share thoughts with other registered members before and after the event."
                  : "This chat will give registered members a place to ask questions, connect, and share thoughts before and after the event."}
              </p>
            </div>
            {eventChatUrl ? (
              <a
                href={eventChatUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-md border border-ipn/20 bg-white px-3 py-2 text-xs font-medium text-ipn transition hover:bg-white/80 sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]"
              >
                Join event chat
              </a>
            ) : (
              <span className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-md border border-ipn/20 bg-white px-3 py-2 text-xs font-medium text-ipn sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]">
                Coming soon
              </span>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Add to calendar
          </p>
          <AddToCalendarButton event={event} compact />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:w-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EventCard({ event, variant = "full" }: Props) {
  const [registered, setRegistered] = useState(event.is_registered)
  const [count, setCount] = useState(event.registration_count)
  const [chat, setChat] = useState<EventChatState>({
    chat_platform: event.chat_platform,
    chat_external_url: event.chat_external_url,
    chat_status: event.chat_status,
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unrsvpConfirming, setUnrsvpConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const countLabel = registrationBand(count)
  const isCompact = variant === "compact"
  const eventChatUrl = registered ? getEventChatUrl(chat) : null
  const isExternalRegistration = Boolean(event.registration_url)
  const isLockedTicketedEvent =
    event.requires_verified_ticket && !event.has_verified_ticket
  const canJoin = canJoinEvent(event.starts_at, event.timezone)

  function handleRegister() {
    setError(null)
    startTransition(async () => {
      const result = await registerForEvent(event.id, event.slug)
      if (result.error) {
        setError(result.error)
        return
      }

      if (!registered) setCount((current) => current + 1)
      if (result.event) setChat(result.event)
      setRegistered(true)
      setConfirmOpen(true)
    })
  }

  function handleJoin() {
    if (event.join_url) {
      window.open(event.join_url, "_blank", "noopener,noreferrer")
    }
  }

  function handleUnrsvp() {
    startTransition(async () => {
      const result = await unregisterFromEvent(event.id, event.slug)
      if (result.error) {
        setError(result.error)
      } else {
        setRegistered(false)
        setCount((c) => Math.max(0, c - 1))
        setUnrsvpConfirming(false)
      }
    })
  }

  return (
    <article className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm ${isCompact ? "" : "sm:p-4"}`}>
      <div className={`grid gap-4 ${isCompact ? "" : "sm:grid-cols-[220px_1fr]"}`}>
        <EventArtwork event={event} compact={isCompact} />

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
              {event.event_type}
            </span>
            <span className="text-xs text-zinc-400">
              <EventDateTime
                startsAt={event.starts_at}
                endsAt={event.ends_at}
                timezone={event.timezone}
              />
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

            {isLockedTicketedEvent ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-xl text-xs leading-5 text-zinc-500">
                  Register on Eventbrite with the same email you use for this
                  portal. If the email does not match, use the Zoom link from
                  your Eventbrite confirmation email.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                  <AddToCalendarButton event={event} compact />
                  {event.registration_url && (
                    <a
                      href={event.registration_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
                    >
                      Register on Eventbrite
                    </a>
                  )}
                </div>
              </div>
            ) : !registered && !isExternalRegistration ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-8 text-xs font-medium text-zinc-400">
                  {countLabel}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                  <AddToCalendarButton event={event} compact />
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={pending}
                    className="min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
                  >
                    {pending ? "Saving..." : "RSVP"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
                  {countLabel && (
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600">
                      {countLabel}
                    </span>
                  )}
                  {eventChatUrl ? (
                    <a
                      href={eventChatUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-ipn/20 bg-ipn-light px-2.5 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn-light/70 sm:min-h-0"
                    >
                      Join chat
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="min-h-11 rounded-md border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-400 sm:min-h-0"
                    >
                      Event chat coming soon
                    </button>
                  )}
                  {unrsvpConfirming ? (
                    <div className="col-span-2 grid grid-cols-2 items-center gap-1.5 sm:flex">
                      <span className="col-span-2 text-xs text-zinc-500 sm:col-span-1">Cancel your RSVP?</span>
                      <button
                        type="button"
                        onClick={handleUnrsvp}
                        disabled={pending}
                        className="min-h-11 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:min-h-0"
                      >
                        Yes, cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnrsvpConfirming(false)}
                        className="min-h-11 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 transition hover:text-zinc-600 sm:min-h-0 sm:border-0"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUnrsvpConfirming(true)}
                      className="min-h-11 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-red-200 hover:text-red-600 sm:min-h-0"
                    >
                      Cancel RSVP
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 sm:items-end">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <AddToCalendarButton event={event} compact />
                    {canJoin ? (
                      <button
                        type="button"
                        onClick={handleJoin}
                        className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 sm:min-h-0"
                      >
                        Join
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Join link will be available 24 hours before the event starts"
                        className="min-h-11 cursor-not-allowed rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 sm:min-h-0"
                      >
                        Join
                      </button>
                    )}
                  </div>
                  {!canJoin && (
                    <p className="text-[11px] text-zinc-400">Event link available 24 hours before start</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmationModal
          event={{ ...event, ...chat }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </article>
  )
}
