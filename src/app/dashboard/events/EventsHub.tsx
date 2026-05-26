"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import EventCard from "@/components/events/EventCard"
import { formatEventDateTime } from "@/lib/events/calendar"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"

type Props = {
  upcomingEvents: EventWithRegistration[]
  recordings: EventRecord[]
}

type EventTab = "upcoming" | "recordings"
type RecordingTab = "IPN Lab" | "PsychedelX"

function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M8 5.14v13.72c0 .6.67.96 1.16.62l10.04-6.86a.75.75 0 0 0 0-1.24L9.16 4.52A.75.75 0 0 0 8 5.14Z" />
    </svg>
  )
}

function recordingDate(event: EventRecord) {
  const value = event.recording_published_at ?? event.starts_at
  return formatEventDateTime(value, null, event.timezone)
}

function recordingsByType(recordings: EventRecord[], type: RecordingTab) {
  return recordings.filter((recording) => recording.event_type === type)
}

function RecordingCard({ recording }: { recording: EventRecord }) {
  return (
    <Link href={`/dashboard/events/${recording.slug}`} className="block h-full">
      <article className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-ipn/30 hover:shadow-md">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900">
          {recording.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recording.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#a78bfa_0,#664fa1_35%,#18181b_75%)]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ipn shadow-sm">
              <PlayIcon />
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
              {recording.event_type}
            </span>
            {recording.recording_provider && (
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">
                {recording.recording_provider}
              </span>
            )}
          </div>

          <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-900">
            {recording.title}
          </h3>
          <p className="mt-2 text-xs text-zinc-400">
            {recordingDate(recording)}
          </p>
          {recording.speakers && (
            <p className="mt-2 line-clamp-1 text-xs text-zinc-500">
              {recording.speakers}
            </p>
          )}
          {recording.summary && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-500">
              {recording.summary}
            </p>
          )}

          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-ipn">
            View recording
            <ArrowIcon />
          </span>
        </div>
      </article>
    </Link>
  )
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">{body}</p>
    </div>
  )
}

export default function EventsHub({ upcomingEvents, recordings }: Props) {
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming")
  const [recordingTab, setRecordingTab] = useState<RecordingTab>("PsychedelX")

  const ipnLabsRecordings = useMemo(
    () => recordingsByType(recordings, "IPN Lab"),
    [recordings],
  )
  const psychedelXRecordings = useMemo(
    () => recordingsByType(recordings, "PsychedelX"),
    [recordings],
  )
  const activeRecordings =
    recordingTab === "IPN Lab" ? ipnLabsRecordings : psychedelXRecordings

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-ipn/20 bg-ipn/5 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-medium text-ipn">What is included</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              Register for upcoming events and revisit past IPN programming.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Upcoming events stay easy to RSVP for, while past recordings are
              organized by IPN Labs and PsychedelX for browsing after the fact.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className="rounded-lg border border-white bg-white px-3 py-3 text-left shadow-sm transition hover:border-ipn/20"
            >
              <span className="block text-sm font-semibold text-zinc-900">
                Upcoming
              </span>
              <span className="mt-1 block text-xs text-zinc-400">
                {upcomingEvents.length} scheduled
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("recordings")}
              className="rounded-lg border border-white bg-white px-3 py-3 text-left shadow-sm transition hover:border-ipn/20"
            >
              <span className="block text-sm font-semibold text-zinc-900">
                Past Recordings
              </span>
              <span className="mt-1 block text-xs text-zinc-400">
                {recordings.length} available
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
        {[
          ["upcoming", "Upcoming"],
          ["recordings", "Past Recordings"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as EventTab)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === id
                ? "bg-ipn text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "upcoming" && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ipn">Upcoming</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              Upcoming IPN events
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Register for IPN Lab seminars, PsychedelX programming, and future
              member meetups from one place.
            </p>
          </div>

          {upcomingEvents.length ? (
            <div className="flex flex-col gap-4">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No upcoming events yet"
              body="New IPN events will appear here once the leadership team adds them to the portal."
            />
          )}
        </section>
      )}

      {activeTab === "recordings" && (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-medium text-ipn">Past recordings</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                Event recordings
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Watch past IPN Labs and PsychedelX sessions from the member
                portal.
              </p>
            </div>
            <div className="flex gap-2 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
              {[
                ["IPN Lab", `IPN Labs (${ipnLabsRecordings.length})`],
                ["PsychedelX", `PsychedelX (${psychedelXRecordings.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRecordingTab(id as RecordingTab)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                    recordingTab === id
                      ? "bg-ipn text-white shadow-sm"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeRecordings.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRecordings.map((recording) => (
                <RecordingCard key={recording.id} recording={recording} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title={`No ${recordingTab === "IPN Lab" ? "IPN Labs" : "PsychedelX"} recordings published yet`}
              body="Recordings will appear here once real session links and descriptions are approved."
            />
          )}
        </section>
      )}
    </div>
  )
}
