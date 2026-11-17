"use client"

import { useState, useTransition } from "react"
import { CheckIcon } from "@heroicons/react/24/outline"
import Link from "next/link"
import EventArtwork from "@/components/events/EventArtwork"
import styles from "./EventArtworkCard.module.css"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import EventDateTime from "@/components/events/EventDateTime"
import ExternalRegistrationAction from "@/components/events/ExternalRegistrationAction"
import { registerForEvent, unregisterFromEvent } from "@/lib/events/actions"
import { canJoinEvent, registrationBand } from "@/lib/events/calendar"
import { externalRegistrationStatus } from "@/lib/events/external-registration"
import { getPortalAnalyticsContext } from "@/lib/portal-analytics/client"
import type { EventWithRegistration } from "@/lib/events/types"
import WhatsAppHandoffAction from "@/components/whatsapp/WhatsAppHandoffAction"

type Props = {
  event: EventWithRegistration
  variant?: "compact" | "full" | "featured"
}

function hasEventChat(event: EventWithRegistration) {
  return event.chat_platform === "whatsapp"
    && event.chat_status === "active"
    && Boolean(event.chat_external_url)
}

function ConfirmationModal({
  event,
  onClose,
}: {
  event: EventWithRegistration
  onClose: () => void
}) {
  const eventChatAvailable = hasEventChat(event)

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
            We&apos;ll email you a confirmation now, plus reminders 24 hours and
            1 hour before the event. The join link will also be available from
            this event page before the session starts.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                IPN Event-Specific WhatsApp Chat
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {eventChatAvailable
                  ? "Use this chat to ask questions, connect, and share thoughts with other registered members before and after the event."
                  : "This chat will give registered members a place to ask questions, connect, and share thoughts before and after the event."}
              </p>
            </div>
            {eventChatAvailable ? (
              <WhatsAppHandoffAction
                kind="event"
                slug={event.slug}
                source="event-rsvp-confirmation"
                label="Join event chat"
                className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-md border border-ipn/20 bg-white px-3 py-2 text-xs font-medium text-ipn transition hover:bg-white/80 sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]"
              />
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
  const [eventChatAvailable, setEventChatAvailable] = useState(hasEventChat(event))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unrsvpConfirming, setUnrsvpConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const countLabel = registrationBand(count)
  const isCompact = variant === "compact"
  const isFeatured = variant === "featured"
  const showEventChat = registered && eventChatAvailable
  const isExternalRegistration = Boolean(event.registration_url)
  const isLockedTicketedEvent =
    event.requires_verified_ticket && !event.has_verified_ticket
  const usesExternalRegistration =
    isExternalRegistration
    && !(event.requires_verified_ticket && event.has_verified_ticket)
  const canJoin = canJoinEvent(event.starts_at, event.timezone)

  function handleRegister() {
    setError(null)
    startTransition(async () => {
      const result = await registerForEvent(event.id, event.slug, getPortalAnalyticsContext())
      if (result.error) {
        setError(result.error)
        return
      }

      if (!registered) setCount((current) => current + 1)
      if (result.eventChatAvailable !== undefined) setEventChatAvailable(result.eventChatAvailable)
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
      const result = await unregisterFromEvent(event.id, event.slug, getPortalAnalyticsContext())
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
    <article className={`${styles.card} ${!isCompact && !isLockedTicketedEvent && !error && !unrsvpConfirming ? styles.flush : ""} overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm`}>
      <div className={styles.layout}>
        <Link
          href={`/dashboard/events/${event.slug}`}
          data-analytics-event="curated_click"
          data-analytics-id={`event-detail-artwork-${event.slug}`}
          data-analytics-label="Event detail artwork"
          aria-label={`View ${event.title}`}
          className={styles.artwork}
        >
          <EventArtwork src={event.thumbnail_url} />
        </Link>

        <div className={styles.body}>
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

          <Link
            href={`/dashboard/events/${event.slug}`}
            data-analytics-event="curated_click"
            data-analytics-id={`event-detail-title-${event.slug}`}
            data-analytics-label="Event detail title"
            className="mt-2 block group"
          >
            <h2 title={event.title} className={`${isFeatured ? "text-xl" : "text-base"} font-semibold leading-snug text-zinc-900 group-hover:text-ipn`}>
              {event.title}
            </h2>
          </Link>

          {event.summary && (
            <p className={`${styles.summary} mt-2 text-sm leading-6 text-zinc-500 ${isCompact ? "line-clamp-2" : ""}`}>
              {event.summary}
            </p>
          )}

          <div className={`${styles.metadata} mt-3 flex flex-col gap-1 text-xs leading-5 text-zinc-400`}>
            {!isFeatured && event.speakers && (
              <p>
                <span className="font-medium text-zinc-500">Speakers:</span>{" "}
                {event.speakers}
              </p>
            )}
            {event.location_label && (
              <p>
                <span className="font-medium text-zinc-500">Location:</span>{" "}
                {event.location_label}
              </p>
            )}
          </div>

        </div>

        <div className={`${styles.actions} ${styles.eventActions}`}>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

          {isFeatured ? (
            <>
              <p className={styles.actionStatus}>
                {usesExternalRegistration
                  ? externalRegistrationStatus(event.registration_provider)
                  : registered ? "You’re registered" : "Not registered"}
              </p>
              <div className={styles.actionControls}>
                <Link href={`/dashboard/events/${event.slug}`} className={styles.primaryButton}>View event</Link>
                <AddToCalendarButton event={event} compact className={styles.calendarButton} />
              </div>
            </>
          ) : usesExternalRegistration ? (
            <>
              {isLockedTicketedEvent ? (
                <p className="text-xs leading-5 text-zinc-500">
                  Register on Eventbrite with the same email you use for this
                  portal. If the email does not match, use the Zoom link from
                  your Eventbrite confirmation email.
                </p>
              ) : <p className={styles.actionStatus}>{externalRegistrationStatus(event.registration_provider)}</p>}
              <div className={styles.actionControls}>
                {event.registration_url && (
                  <ExternalRegistrationAction
                    url={event.registration_url}
                    provider={event.registration_provider}
                    analyticsId={`external-registration-${event.slug}`}
                    className={styles.primaryButton}
                  />
                )}
                <AddToCalendarButton event={event} compact className={styles.calendarButton} />
              </div>
            </>
          ) : !registered ? (
            <>
              <div className={styles.statusLine}>
                <p className={styles.actionStatus}>Not registered</p>
                {countLabel && <span className={styles.attendanceCount}>{countLabel}</span>}
              </div>
              <div className={styles.actionControls}>
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={pending}
                  data-analytics-event="curated_click"
                  data-analytics-id={`event-rsvp-${event.slug}`}
                  data-analytics-label="RSVP"
                  className={styles.primaryButton}
                >
                  {pending ? "Saving..." : "RSVP"}
                </button>
                <AddToCalendarButton event={event} compact className={styles.calendarButton} />
              </div>
            </>
          ) : (
            <>
              <div className={styles.statusLine}>
                <p className={styles.registeredStatus}>
                  <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  You’re registered
                </p>
                {countLabel && <span className={styles.attendanceCount}>{countLabel}</span>}
              </div>
              <div className={styles.actionControls}>
                <div className={styles.joinAction}>
                  {canJoin && event.join_url ? (
                    <button
                      type="button"
                      onClick={handleJoin}
                      data-analytics-event="curated_click"
                      data-analytics-id={`event-join-${event.slug}`}
                      data-analytics-label="Join event"
                      className={styles.primaryButton}
                    >
                      Join event
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={!canJoin ? "Join link will be available 24 hours before the event starts" : "Join link not available yet"}
                      className={styles.primaryButton}
                    >
                      Join event
                    </button>
                  )}
                  {(!canJoin || !event.join_url) && (
                    <p className={styles.availabilityNote}>
                      {!canJoin ? "Opens 24 hours before start." : "Join link not available yet."}
                    </p>
                  )}
                </div>
                <AddToCalendarButton event={event} compact className={styles.calendarButton} />
              </div>
              <div className={styles.secondaryActions}>
                {showEventChat ? (
                  <WhatsAppHandoffAction
                    kind="event"
                    slug={event.slug}
                    source="event-card"
                    label="Join chat"
                    className={styles.quietAction}
                  />
                ) : <span className={styles.unavailableChat}>Chat coming soon</span>}
                {!unrsvpConfirming && (
                  <button
                    type="button"
                    onClick={() => setUnrsvpConfirming(true)}
                    data-analytics-event="curated_click"
                    data-analytics-id={`event-cancel-rsvp-start-${event.slug}`}
                    data-analytics-label="Cancel RSVP"
                    className={`${styles.quietAction} ${styles.cancelAction}`}
                  >
                    Cancel RSVP
                  </button>
                )}
              </div>
              {unrsvpConfirming && (
                <div className={styles.cancelConfirmation}>
                  <p className="text-xs text-zinc-600">Cancel your RSVP?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleUnrsvp}
                      disabled={pending}
                      data-analytics-event="curated_click"
                      data-analytics-id={`event-cancel-rsvp-confirm-${event.slug}`}
                      data-analytics-label="Confirm cancel RSVP"
                      className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"
                    >
                      Yes, cancel
                    </button>
                    <button type="button" onClick={() => setUnrsvpConfirming(false)} className="min-h-11 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600">
                      Keep RSVP
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmOpen && (
        <ConfirmationModal
          event={{
            ...event,
            chat_platform: eventChatAvailable ? "whatsapp" : null,
            chat_status: eventChatAvailable ? "active" : null,
            chat_external_url: eventChatAvailable ? "available" : null,
          }}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </article>
  )
}
