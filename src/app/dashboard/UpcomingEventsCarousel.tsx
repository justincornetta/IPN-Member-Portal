"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import CommunityEventDetail, { type CommunityActivity } from "@/components/events/CommunityEventDetail"
import EventDateTime from "@/components/events/EventDateTime"
import { registrationBand } from "@/lib/events/calendar"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type Props = {
  events: EventWithRegistration[]
  conferences: ConferenceRecord[]
  totalCount: number
  className?: string
}

type HomepageTab = "events" | "conferences"
type Activity =
  | { key: string; kind: "event"; startsAt: string; event: EventWithRegistration }
  | { key: string; kind: "community"; startsAt: string; item: CommunityActivity }

function EventArtwork({ event }: { event: EventWithRegistration }) {
  return (
    <Link href={`/dashboard/events/${event.slug}`} className="relative block aspect-video w-full overflow-hidden rounded-lg bg-zinc-950">
      {event.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.thumbnail_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#a78bfa_0,#664fa1_35%,#18181b_75%)]" />
      )}
    </Link>
  )
}

function EventPreview({ event }: { event: EventWithRegistration }) {
  const countLabel = registrationBand(event.registration_count)
  return (
    <article className="grid h-full min-w-0 gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(13rem,0.72fr)_minmax(0,1.28fr)] md:p-5">
      <EventArtwork event={event} />
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-semibold text-ipn">{event.event_type}</span>
          <span className="text-xs text-zinc-500"><EventDateTime startsAt={event.starts_at} endsAt={event.ends_at} timezone={event.timezone} /></span>
          {countLabel && <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">{countLabel}</span>}
        </div>
        <Link href={`/dashboard/events/${event.slug}`} className="group mt-3">
          <h3 className="text-lg font-semibold leading-snug text-zinc-900 group-hover:text-ipn">{event.title}</h3>
        </Link>
        {event.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">{event.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Link href={`/dashboard/events/${event.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0">
            {event.is_registered ? "View event" : "Event details"}
          </Link>
          <AddToCalendarButton event={event} compact />
        </div>
      </div>
    </article>
  )
}

function ConferencePreview({ conference }: { conference?: ConferenceRecord }) {
  if (!conference) {
    return <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">New conference opportunities will appear here.</div>
  }
  const location = [conference.city, conference.state ?? conference.country].filter(Boolean).join(", ")
  const meetup = conference.meetups[0]
  return (
    <article className="flex min-h-64 flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-semibold text-ipn">{conference.category}</span>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${meetup ? "bg-[#E4F6F1] text-[#176B5B]" : "bg-zinc-100 text-zinc-500"}`}>
          {conference.meetups.length ? `${conference.meetups.length} IPN meetup${conference.meetups.length === 1 ? "" : "s"}` : "No IPN meetup announced"}
        </span>
      </div>
      <Link href={`/dashboard/conferences/${conference.slug}`} className="group mt-3">
        <h3 className="text-xl font-semibold text-zinc-900 group-hover:text-ipn">{conference.name}</h3>
      </Link>
      <p className="mt-2 text-sm text-zinc-500"><EventDateTime startsAt={conference.starts_at} endsAt={conference.ends_at} timezone={conference.timezone} />{location ? ` · ${location}` : ""}</p>
      {conference.summary && <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-6 text-zinc-600">{conference.summary}</p>}
      {meetup && (
        <div className="mt-4 rounded-lg border border-[#BFE8DE] bg-[#F1FBF8] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#176B5B]">Community meetup available</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{meetup.title}</p>
          <p className="mt-1 text-xs text-zinc-500"><EventDateTime startsAt={meetup.startsAt} endsAt={null} timezone={conference.timezone} />{meetup.location ? ` · ${meetup.location}` : ""}</p>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Link href={`/dashboard/conferences/${conference.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0">View conference</Link>
        {meetup && <Link href={`/dashboard/conferences/${conference.slug}#ipn-meetups`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#9DDCCE] px-4 py-2 text-sm font-semibold text-[#176B5B] transition hover:bg-[#F1FBF8] sm:min-h-0">RSVP to meetup</Link>}
      </div>
    </article>
  )
}

export default function UpcomingEventsCarousel({ events, conferences = [], totalCount, className = "" }: Props) {
  const [activeTab, setActiveTab] = useState<HomepageTab>("events")
  const activities = useMemo<Activity[]>(() => [
    ...events.map((event) => ({ key: `event:${event.id}`, kind: "event" as const, startsAt: event.starts_at, event })),
    ...conferences.flatMap((conference) => conference.meetups.map((meetup) => ({ key: `community:${conference.id}:${meetup.id}`, kind: "community" as const, startsAt: meetup.startsAt, item: { meetup, conference } }))),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [conferences, events])
  const [selectedActivityKey, setSelectedActivityKey] = useState(activities[0]?.key)
  const [selectedConferenceId, setSelectedConferenceId] = useState(conferences[0]?.id)
  const selectedActivity = activities.find((item) => item.key === selectedActivityKey) ?? activities[0]
  const selectedConference = conferences.find((conference) => conference.id === selectedConferenceId) ?? conferences[0]
  const meetupCount = activities.filter((activity) => activity.kind === "community").length

  return (
    <section className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ipn">Upcoming</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">What&apos;s coming up at IPN</h2>
        </div>
        <Link href={activeTab === "events" ? "/dashboard/events" : "/dashboard/conferences"} className="inline-flex min-h-11 items-center text-sm font-medium text-ipn hover:underline sm:min-h-0">View all {activeTab === "events" ? "events" : "conferences"}</Link>
      </div>

      <div className="mt-4 inline-flex max-w-full rounded-lg border border-zinc-200 bg-zinc-50 p-1" role="tablist" aria-label="Upcoming IPN activity">
        <button type="button" role="tab" aria-selected={activeTab === "events"} onClick={() => setActiveTab("events")} className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition ${activeTab === "events" ? "bg-white text-ipn shadow-sm ring-1 ring-ipn/20" : "text-zinc-500 hover:text-zinc-900"}`}>
          IPN Events <span className="ml-1 text-xs text-zinc-400">{totalCount + meetupCount} upcoming</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "conferences"} onClick={() => setActiveTab("conferences")} className={`min-h-10 rounded-md px-3 py-2 text-sm font-medium transition ${activeTab === "conferences" ? "bg-white text-ipn shadow-sm ring-1 ring-ipn/20" : "text-zinc-500 hover:text-zinc-900"}`}>
          Conferences {meetupCount > 0 && <span className="ml-1 rounded-full bg-[#E4F6F1] px-2 py-0.5 text-[11px] font-semibold text-[#176B5B]">{meetupCount} meetup{meetupCount === 1 ? "" : "s"}</span>}
        </button>
      </div>

      {activeTab === "events" && selectedActivity ? (
        <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="max-h-[22rem] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50 p-1" aria-label="IPN events agenda">
            {activities.map((activity) => {
              const community = activity.kind === "community"
              const title = community ? activity.item.meetup.title : activity.event.title
              const label = community ? "Community" : activity.event.event_type
              return <button key={activity.key} type="button" aria-pressed={selectedActivity.key === activity.key} onClick={() => setSelectedActivityKey(activity.key)} className={`w-full rounded-lg px-3 py-3 text-left transition ${selectedActivity.key === activity.key ? (community ? "bg-white shadow-sm ring-1 ring-[#9DDCCE]" : "bg-white shadow-sm ring-1 ring-ipn/20") : "hover:bg-white"}`}>
                <span className={`block text-[10px] font-semibold uppercase ${community ? "text-[#176B5B]" : "text-ipn"}`}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(activity.startsAt))} · {label}</span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-zinc-800">{title}</span>
              </button>
            })}
          </div>
          {selectedActivity.kind === "event" ? <EventPreview event={selectedActivity.event} /> : <CommunityEventDetail item={selectedActivity.item} compact />}
        </div>
      ) : activeTab === "events" ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center"><h3 className="font-semibold text-zinc-900">New events are coming soon</h3><p className="mt-2 text-sm text-zinc-500">IPN Labs and community events will appear here once announced.</p></div>
      ) : (
        <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="max-h-[22rem] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50 p-1" aria-label="Upcoming conferences agenda">
            {conferences.map((conference) => <button key={conference.id} type="button" aria-pressed={conference.id === selectedConference?.id} onClick={() => setSelectedConferenceId(conference.id)} className={`w-full rounded-lg px-3 py-3 text-left transition ${conference.id === selectedConference?.id ? "bg-white shadow-sm ring-1 ring-ipn/20" : "hover:bg-white"}`}><span className="block text-[10px] font-semibold uppercase text-ipn">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(conference.starts_at))} · {conference.category}</span><span className="mt-1 block text-sm font-semibold leading-5 text-zinc-800">{conference.name}</span><span className={`mt-1 block text-[11px] ${conference.meetups.length ? "text-[#176B5B]" : "text-zinc-400"}`}>{conference.meetups.length ? `${conference.meetups.length} IPN meetup${conference.meetups.length === 1 ? "" : "s"}` : "No meetup announced"}</span></button>)}
          </div>
          <ConferencePreview conference={selectedConference} />
        </div>
      )}
    </section>
  )
}
